from __future__ import annotations

import json
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from prefect import flow, task
from prefect.tasks import task_input_hash
from sqlalchemy import bindparam, create_engine, text


# ---------------------------------------------------------------------------
# Project configuration
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
ENGINE = None

EVENT_TYPES = [
    "inbound_order_created",
    "outbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "ingredient_price_variance_detected",
]

KPI_EVENT_TYPES = {
    "inbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "ingredient_price_variance_detected",
}

TRANSFORM_REVISION = "2026-11-04-v2"


def get_engine():
    """Create the SQLAlchemy engine lazily."""
    global ENGINE

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured.")

    if ENGINE is None:
        ENGINE = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
        )

    return ENGINE


def _normalize_event_timestamp(value: Any) -> datetime:
    """Parse an event timestamp and normalize it to UTC."""
    if isinstance(value, datetime):
        timestamp = value
    else:
        timestamp = datetime.fromisoformat(
            str(value).replace("Z", "+00:00")
        )

    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    return timestamp.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# 1. EXTRACT
# ---------------------------------------------------------------------------
@task(
    name="extract_inventory_telemetry_events",
    retries=3,
    retry_delay_seconds=5,
)
def extract_inventory_telemetry_events(
    watermark_from: str,
    watermark_to: str,
) -> dict:
    """Read business telemetry and location reference data.

    `public.telemetry_events` is read-only for this pipeline. Reporting data
    is written only to the separate `reporting` schema.
    """
    event_query = text("""
        SELECT
            event_id,
            event_timestamp,
            event_type,
            properties
        FROM public.telemetry_events
        WHERE event_timestamp >= :date_from
          AND event_timestamp < :date_to
          AND event_type IN :event_types
        ORDER BY event_timestamp
    """).bindparams(
        bindparam("event_types", expanding=True)
    )

    locations_query = text("""
        SELECT
            id,
            name,
            city,
            country,
            currency
        FROM public."Location"
        ORDER BY id
    """)

    with get_engine().connect() as connection:
        events = connection.execute(
            event_query,
            {
                "date_from": watermark_from,
                "date_to": watermark_to,
                "event_types": EVENT_TYPES,
            },
        ).mappings().all()

        locations = connection.execute(
            locations_query
        ).mappings().all()

    event_records = []
    for event in events:
        record = dict(event)
        if isinstance(record.get("event_timestamp"), datetime):
            record["event_timestamp"] = record["event_timestamp"].isoformat()
        record["event_id"] = str(record["event_id"])
        if not isinstance(record.get("properties"), dict):
            record["properties"] = {}
        event_records.append(record)

    return {
        "events": event_records,
        "locations": [dict(location) for location in locations],
        "rows_extracted": len(event_records),
    }


# ---------------------------------------------------------------------------
# 2. TRANSFORM
# ---------------------------------------------------------------------------
@task(
    name="aggregate_weekly_location_kpis",
    cache_key_fn=task_input_hash,
    cache_expiration=timedelta(minutes=30),
)
def aggregate_weekly_location_kpis(
    extracted_data: dict,
    transform_revision: str = TRANSFORM_REVISION,
) -> dict:
    """Calculate location/week KPIs and quarantine affected grains.

    The explicit `transform_revision` is part of the task input/cache key.
    Increase it whenever transformation logic changes.

    Missing/conflicting data for a known location blocks only that
    location/week. Events with an unknown location remain rejected and are
    recorded in the quality report, without blocking unrelated locations.
    """
    # Referencing this value makes the cache revision an explicit dependency.
    _ = transform_revision

    def to_decimal(value: Any) -> Decimal | None:
        try:
            number = Decimal(str(value))
            if not number.is_finite():
                return None
            return number
        except (InvalidOperation, TypeError, ValueError):
            return None

    def normalize_country(value: Any) -> str | None:
        normalized = str(value or "").strip().upper()
        if normalized in {"CO", "COLOMBIA"}:
            return "CO"
        if normalized in {
            "US",
            "USA",
            "UNITED STATES",
            "UNITED STATES OF AMERICA",
            "ESTADOS UNIDOS",
        }:
            return "US"
        return None

    locations = {
        str(location["id"]): location
        for location in extracted_data.get("locations", [])
    }

    aggregates: dict[tuple[str, str], dict[str, Any]] = {}
    quality_issues: list[str] = []
    quality_warnings: list[str] = []
    blocked_location_weeks: set[tuple[str, str]] = set()
    seen_event_ids: set[str] = set()
    rows_skipped = 0
    rows_processed = 0

    for event in extracted_data.get("events", []):
        event_id = str(event.get("event_id", "unknown"))

        if event_id in seen_event_ids:
            rows_skipped += 1
            quality_warnings.append(f"Duplicate event ignored: {event_id}")
            continue
        seen_event_ids.add(event_id)

        properties = event.get("properties") or {}
        if not isinstance(properties, dict):
            properties = {}
        event_type = event.get("event_type")

        # Outbound events are context only, not one of the five report KPIs.
        if event_type not in KPI_EVENT_TYPES:
            rows_skipped += 1
            continue

        # Demo/test records must not affect business reporting.
        if str(properties.get("demo_record", "")).strip().lower() in {
            "true", "1", "yes"
        }:
            rows_skipped += 1
            quality_warnings.append(f"Demo event excluded: {event_id}")
            continue

        try:
            timestamp = _normalize_event_timestamp(event.get("event_timestamp"))
        except (TypeError, ValueError, OverflowError) as exc:
            quality_issues.append(
                f"Invalid event timestamp for event {event_id}: {exc}"
            )
            continue

        event_week = (
            timestamp.date() - timedelta(days=timestamp.weekday())
        ).isoformat()

        location_id = str(properties.get("location_id") or "")
        location = locations.get(location_id)

        if location is None:
            quality_issues.append(
                f"Unknown location: {location_id}, event: {event_id}"
            )
            continue

        # The Location reference table is the canonical country/currency data.
        country = normalize_country(location.get("country"))
        currency = str(location.get("currency") or "").strip().upper()
        grain = (location_id, event_week)

        if country is None or not currency:
            blocked_location_weeks.add(grain)
            quality_issues.append(
                "Invalid reference country/currency for "
                f"location {location_id}, event {event_id}"
            )
            continue

        # Missing event metadata is enriched from Location; conflicts are rejected.
        event_country = properties.get("country")
        if (
            event_country not in (None, "")
            and normalize_country(event_country) != country
        ):
            blocked_location_weeks.add(grain)
            quality_issues.append(f"Country mismatch for event {event_id}")
            continue

        event_currency = properties.get("currency")
        if (
            event_currency not in (None, "")
            and str(event_currency).strip().upper() != currency
        ):
            blocked_location_weeks.add(grain)
            quality_issues.append(f"Currency mismatch for event {event_id}")
            continue

        # Validate cost events before adding them to the aggregate.
        total_cost = None
        if event_type in {"inbound_order_created", "stock_waste_registered"}:
            unit_cost = to_decimal(properties.get("unit_cost"))
            total_cost = to_decimal(properties.get("total_cost"))
            if (
                unit_cost is None
                or total_cost is None
                or unit_cost <= 0
                or total_cost < 0
            ):
                blocked_location_weeks.add(grain)
                quality_issues.append(
                    f"Missing or invalid cost in event {event_id}"
                )
                continue

        key = grain
        if key not in aggregates:
            aggregates[key] = {
                "location_id": location_id,
                "country": country,
                "week_start": event_week,
                "total_purchase_cost": Decimal("0"),
                "total_waste_cost": Decimal("0"),
                "stockout_events_count": 0,
                "price_alert_events_count": 0,
                "currency": currency,
            }

        row = aggregates[key]

        if event_type == "inbound_order_created":
            row["total_purchase_cost"] += total_cost
        elif event_type == "stock_waste_registered":
            row["total_waste_cost"] += total_cost
        elif event_type == "stock_threshold_triggered":
            row["stockout_events_count"] += 1
        elif event_type == "ingredient_price_variance_detected":
            row["price_alert_events_count"] += 1

        rows_processed += 1

    result_rows = []
    for key, row in aggregates.items():
        # Never publish a partial KPI for a location/week containing a rejected
        # KPI event. Other locations/weeks can still be loaded safely.
        if key in blocked_location_weeks:
            continue

        purchase_cost = row["total_purchase_cost"]
        waste_cost = row["total_waste_cost"]
        row["waste_ratio"] = (
            float(waste_cost / purchase_cost)
            if purchase_cost > 0
            else 0.0
        )
        row["total_purchase_cost"] = float(purchase_cost)
        row["total_waste_cost"] = float(waste_cost)
        result_rows.append(row)

    return {
        "rows": sorted(
            result_rows,
            key=lambda row: (row["week_start"], row["location_id"]),
        ),
        "rows_processed": rows_processed,
        "rows_rejected": len(quality_issues),
        "rows_skipped": rows_skipped,
        "quality_issues": quality_issues,
        "quality_warnings": quality_warnings,
        "blocked_location_weeks": [
            {"location_id": location_id, "week_start": week_start}
            for location_id, week_start in sorted(blocked_location_weeks)
        ],
    }


# ---------------------------------------------------------------------------
# 3. LOAD AND AUDIT TABLES
# ---------------------------------------------------------------------------
@task(
    name="ensure_reporting_tables",
    retries=3,
    retry_delay_seconds=5,
)
def ensure_reporting_tables() -> None:
    """Create the business reporting and pipeline audit tables if needed."""
    with get_engine().begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS reporting"))

        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS reporting.weekly_location_performance (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                location_id TEXT NOT NULL,
                country TEXT NOT NULL,
                week_start DATE NOT NULL,
                total_purchase_cost NUMERIC NOT NULL DEFAULT 0,
                total_waste_cost NUMERIC NOT NULL DEFAULT 0,
                waste_ratio NUMERIC NOT NULL DEFAULT 0,
                stockout_events_count INTEGER NOT NULL DEFAULT 0,
                price_alert_events_count INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL,
                computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (location_id, week_start)
            )
        """))

        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS reporting.pipeline_runs (
                run_id UUID PRIMARY KEY,
                pipeline_name TEXT NOT NULL,
                week_start DATE NOT NULL,
                started_at TIMESTAMPTZ NOT NULL,
                finished_at TIMESTAMPTZ,
                status TEXT NOT NULL,
                last_completed_stage TEXT,
                watermark_from TIMESTAMPTZ,
                watermark_to TIMESTAMPTZ,
                records_processed INTEGER NOT NULL DEFAULT 0,
                rows_extracted INTEGER NOT NULL DEFAULT 0,
                rows_rejected INTEGER NOT NULL DEFAULT 0,
                rows_loaded INTEGER NOT NULL DEFAULT 0,
                error_summary TEXT,
                pipeline_version TEXT,
                trigger_source TEXT
            )
        """))


@task(
    name="upsert_weekly_location_performance",
    retries=3,
    retry_delay_seconds=5,
)
def upsert_weekly_location_performance(rows: list[dict]) -> int:
    """Idempotently load KPI rows using the unique location/week key."""
    if not rows:
        return 0

    statement = text("""
        INSERT INTO reporting.weekly_location_performance (
            location_id,
            country,
            week_start,
            total_purchase_cost,
            total_waste_cost,
            waste_ratio,
            stockout_events_count,
            price_alert_events_count,
            currency
        )
        VALUES (
            :location_id,
            :country,
            :week_start,
            :total_purchase_cost,
            :total_waste_cost,
            :waste_ratio,
            :stockout_events_count,
            :price_alert_events_count,
            :currency
        )
        ON CONFLICT (location_id, week_start)
        DO UPDATE SET
            country = EXCLUDED.country,
            total_purchase_cost = EXCLUDED.total_purchase_cost,
            total_waste_cost = EXCLUDED.total_waste_cost,
            waste_ratio = EXCLUDED.waste_ratio,
            stockout_events_count = EXCLUDED.stockout_events_count,
            price_alert_events_count = EXCLUDED.price_alert_events_count,
            currency = EXCLUDED.currency,
            computed_at = now()
    """)

    with get_engine().begin() as connection:
        for row in rows:
            connection.execute(statement, row)

    return len(rows)


@task(
    name="save_pipeline_run",
    retries=3,
    retry_delay_seconds=5,
)
def save_pipeline_run(
    run_id: str,
    week_start: str,
    started_at: datetime,
    status: str,
    watermark_from: datetime,
    watermark_to: datetime,
    records_processed: int = 0,
    rows_extracted: int = 0,
    rows_rejected: int = 0,
    rows_loaded: int = 0,
    finished_at: datetime | None = None,
    last_completed_stage: str | None = None,
    error_summary: str | None = None,
    trigger_source: str = "schedule",
) -> None:
    statement = text("""
        INSERT INTO reporting.pipeline_runs (
            run_id, pipeline_name, week_start,
            started_at, finished_at, status,
            last_completed_stage,
            watermark_from, watermark_to,
            records_processed, rows_extracted,
            rows_rejected, rows_loaded,
            error_summary, pipeline_version, trigger_source
        )
        VALUES (
            :run_id, :pipeline_name, :week_start,
            :started_at, :finished_at, :status,
            :last_completed_stage,
            :watermark_from, :watermark_to,
            :records_processed, :rows_extracted,
            :rows_rejected, :rows_loaded,
            :error_summary, :pipeline_version, :trigger_source
        )
        ON CONFLICT (run_id)
        DO UPDATE SET
            finished_at = EXCLUDED.finished_at,
            status = EXCLUDED.status,
            last_completed_stage = EXCLUDED.last_completed_stage,
            records_processed = EXCLUDED.records_processed,
            rows_extracted = EXCLUDED.rows_extracted,
            rows_rejected = EXCLUDED.rows_rejected,
            rows_loaded = EXCLUDED.rows_loaded,
            error_summary = EXCLUDED.error_summary
    """)

    with get_engine().begin() as connection:
        connection.execute(statement, {
            "run_id": run_id,
            "pipeline_name": "weekly_location_cost_waste",
            "week_start": date.fromisoformat(week_start),
            "started_at": started_at,
            "finished_at": finished_at,
            "status": status,
            "last_completed_stage": last_completed_stage,
            "watermark_from": watermark_from,
            "watermark_to": watermark_to,
            "records_processed": records_processed,
            "rows_extracted": rows_extracted,
            "rows_rejected": rows_rejected,
            "rows_loaded": rows_loaded,
            "error_summary": error_summary,
            "pipeline_version": os.getenv("GIT_COMMIT_SHA", "local"),
            "trigger_source": trigger_source,
        })


@task(name="save_pipeline_eval_snapshot")
def save_pipeline_eval_snapshot(run_id: str, transformed: dict) -> str:
    """Write an evaluation snapshot without changing source telemetry."""
    eval_dir = ROOT_DIR / "data" / "eval"
    eval_dir.mkdir(parents=True, exist_ok=True)

    output = {
        "run_id": run_id,
        "rows_processed": transformed["rows_processed"],
        "rows_rejected": transformed["rows_rejected"],
        "rows_skipped": transformed.get("rows_skipped", 0),
        "quality_issues": transformed.get("quality_issues", []),
        "quality_warnings": transformed.get("quality_warnings", []),
        "blocked_location_weeks": transformed.get(
            "blocked_location_weeks", []
        ),
        "rows": transformed["rows"],
    }

    output_path = eval_dir / f"pipeline-{run_id}.json"
    output_path.write_text(
        json.dumps(output, indent=2, default=str),
        encoding="utf-8",
    )
    return str(output_path)


# ---------------------------------------------------------------------------
# 4. PREFECT FLOW
# ---------------------------------------------------------------------------
@flow(name="weekly_location_cost_waste_flow")
def weekly_location_cost_waste_flow(
    week_start: str | None = None,
    trigger_source: str = "schedule",
) -> dict:
    """Run extract -> transform -> load and persist an audit record.

    Reprocesses the target week and the preceding three weeks to account for
    late-arriving events. Valid, unaffected location/week rows are loaded;
    rejected grains are withheld and the run is marked `partial`.
    """
    now = datetime.now(timezone.utc)
    current_monday = now.date() - timedelta(days=now.weekday())
    target_week = (
        date.fromisoformat(week_start)
        if week_start
        else current_monday - timedelta(days=7)
    )

    if target_week.weekday() != 0:
        raise ValueError("week_start must be a Monday.")
    watermark_from = datetime.combine(
        target_week - timedelta(days=21),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )
    watermark_to = datetime.combine(
        target_week + timedelta(days=7),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    ensure_reporting_tables()
    save_pipeline_run(
        run_id=run_id,
        week_start=target_week.isoformat(),
        started_at=started_at,
        status="running",
        watermark_from=watermark_from,
        watermark_to=watermark_to,
        trigger_source=trigger_source,
    )

    # 1. EXTRACT: return_state lets the flow audit and handle task failures.
    extraction_state = extract_inventory_telemetry_events(
        watermark_from.isoformat(),
        watermark_to.isoformat(),
        return_state=True,
    )
    if extraction_state.is_failed():
        error = str(extraction_state.message)
        save_pipeline_run(
            run_id=run_id,
            week_start=target_week.isoformat(),
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            status="failed",
            last_completed_stage="start",
            watermark_from=watermark_from,
            watermark_to=watermark_to,
            error_summary=error,
            trigger_source=trigger_source,
        )
        raise RuntimeError(f"Extraction failed: {error}")

    extracted = extraction_state.result()

    # 2. TRANSFORM: explicit revision invalidates results from earlier logic.
    transformation_state = aggregate_weekly_location_kpis(
        extracted,
        transform_revision=TRANSFORM_REVISION,
        return_state=True,
    )
    if transformation_state.is_failed():
        error = str(transformation_state.message)
        save_pipeline_run(
            run_id=run_id,
            week_start=target_week.isoformat(),
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            status="failed",
            last_completed_stage="extract",
            watermark_from=watermark_from,
            watermark_to=watermark_to,
            rows_extracted=extracted["rows_extracted"],
            error_summary=error,
            trigger_source=trigger_source,
        )
        raise RuntimeError(f"Transformation failed: {error}")

    transformed = transformation_state.result()

    # Optional evaluation snapshot: its failure must not block KPI loading.
    snapshot_state = save_pipeline_eval_snapshot(
        run_id,
        transformed,
        return_state=True,
    )
    if snapshot_state.is_failed():
        print(
            "Optional evaluation snapshot failed. "
            "Continuing with the main pipeline."
        )

    # 3. LOAD: publish valid, unaffected grains even when other records fail.
    load_state = upsert_weekly_location_performance(
        transformed["rows"],
        return_state=True,
    )
    if load_state.is_failed():
        error = str(load_state.message)
        save_pipeline_run(
            run_id=run_id,
            week_start=target_week.isoformat(),
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            status="failed",
            last_completed_stage="transform",
            watermark_from=watermark_from,
            watermark_to=watermark_to,
            records_processed=transformed["rows_processed"],
            rows_extracted=extracted["rows_extracted"],
            rows_rejected=transformed["rows_rejected"],
            error_summary=error,
            trigger_source=trigger_source,
        )
        raise RuntimeError(f"Loading failed: {error}")

    rows_loaded = load_state.result()
    final_status = (
        "partial" if transformed["rows_rejected"] > 0 else "completed"
    )
    error_summary = "; ".join(transformed["quality_issues"]) or None

    save_pipeline_run(
        run_id=run_id,
        week_start=target_week.isoformat(),
        started_at=started_at,
        finished_at=datetime.now(timezone.utc),
        status=final_status,
        last_completed_stage="load",
        watermark_from=watermark_from,
        watermark_to=watermark_to,
        records_processed=transformed["rows_processed"],
        rows_extracted=extracted["rows_extracted"],
        rows_rejected=transformed["rows_rejected"],
        rows_loaded=rows_loaded,
        error_summary=error_summary,
        trigger_source=trigger_source,
    )

    return {
        "status": final_status,
        "run_id": run_id,
        "rows_processed": transformed["rows_processed"],
        "rows_rejected": transformed["rows_rejected"],
        "rows_skipped": transformed["rows_skipped"],
        "rows_loaded": rows_loaded,
        "quality_issues": transformed["quality_issues"],
        "quality_warnings": transformed["quality_warnings"],
    }


if __name__ == "__main__":
    weekly_location_cost_waste_flow()
