from __future__ import annotations

import hashlib
import json
import os
import uuid
from contextlib import ExitStack, contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv
from prefect import flow, get_run_logger, task
from prefect.tasks import task_input_hash
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import Engine


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parents[2]
# Load local settings first. Real process environment variables still take
# precedence because load_dotenv does not overwrite existing variables.
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

# Prefer separate credentials in deployed environments. DATABASE_URL remains
# a compatibility fallback for local development and existing deployments.
DATABASE_URL = os.getenv("DATABASE_URL")
SOURCE_DATABASE_URL = os.getenv("SOURCE_DATABASE_URL") or DATABASE_URL
REPORTING_DATABASE_URL = os.getenv("REPORTING_DATABASE_URL") or DATABASE_URL

# ENGINE is retained as a compatibility hook for existing tests/callers that
# patch the legacy reporting engine variable.
ENGINE: Engine | None = None
_SOURCE_ENGINE: Engine | None = None

EVENT_TYPES = (
    "inbound_order_created",
    "outbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "ingredient_price_variance_detected",
)

# Outbound events are extracted for source observability but do not contribute
# to the five business KPIs in this report.
KPI_EVENT_TYPES = {
    "inbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "ingredient_price_variance_detected",
}

TRANSFORM_REVISION = "2026-11-05-v1"
PIPELINE_NAME = "weekly_location_cost_waste"
CORRECTION_WINDOW_WEEKS = 4


# ---------------------------------------------------------------------------
# Database engines and concurrency protection
# ---------------------------------------------------------------------------


def _create_engine(database_url: str | None, label: str) -> Engine:
    if not database_url:
        raise RuntimeError(
            f"{label} database URL is not configured. Set "
            f"{label.upper().replace(' ', '_')}_DATABASE_URL or DATABASE_URL."
        )
    return create_engine(database_url, pool_pre_ping=True)


def get_engine() -> Engine:
    """Backward-compatible engine accessor (uses the reporting connection)."""
    return get_reporting_engine()


def get_source_engine() -> Engine:
    """Engine used only for read-only telemetry and location extraction."""
    global _SOURCE_ENGINE
    if SOURCE_DATABASE_URL == REPORTING_DATABASE_URL:
        return get_engine()
    if _SOURCE_ENGINE is None:
        _SOURCE_ENGINE = _create_engine(SOURCE_DATABASE_URL, "source")
    return _SOURCE_ENGINE


def get_reporting_engine() -> Engine:
    """Engine used for reporting tables, audit records and advisory locks."""
    global ENGINE
    if ENGINE is None:
        ENGINE = _create_engine(REPORTING_DATABASE_URL, "reporting")
    return ENGINE


@contextmanager
def postgres_week_advisory_lock(week_start: date) -> Iterator[None]:
    """Hold a blocking PostgreSQL session lock for one reporting week."""
    lock_name = f"brasaland-weekly-location-cost-waste:{week_start.isoformat()}"
    lock_key = int.from_bytes(
        hashlib.sha256(lock_name.encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=True,
    )

    connection = get_reporting_engine().connect()
    acquired = False
    try:
        # This is a session-level lock. Committing the SELECT does not release
        # it; the same connection must remain open until the context exits.
        connection.execute(
            text("SELECT pg_advisory_lock(:lock_key)"),
            {"lock_key": lock_key},
        )
        connection.commit()
        acquired = True
        yield
    finally:
        try:
            if acquired:
                unlocked = connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_key)"),
                    {"lock_key": lock_key},
                ).scalar_one()
                connection.commit()
                if not unlocked:
                    raise RuntimeError(
                        f"PostgreSQL advisory lock was not released for {week_start}."
                    )
        except Exception:
            connection.invalidate()
            raise
        finally:
            connection.close()


@contextmanager
def postgres_reporting_window_advisory_lock(
    target_week: date,
) -> Iterator[None]:
    """Lock all four weeks the flow may rewrite, in a stable order.

    The extraction window covers the target week and the three preceding
    weeks. Locking all four prevents overlapping backfills from racing while
    updating a shared weekly grain. Sorted acquisition avoids deadlocks.
    """
    weeks = [
        target_week - timedelta(weeks=offset)
        for offset in range(CORRECTION_WINDOW_WEEKS - 1, -1, -1)
    ]
    with ExitStack() as stack:
        for week in sorted(weeks):
            stack.enter_context(postgres_week_advisory_lock(week))
        yield


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------


def _utc_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        result = value
    else:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if result.tzinfo is None:
        # Source timestamps without offsets are treated as UTC by contract.
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc)


def _country_code(value: Any) -> str | None:
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


def _to_decimal(value: Any) -> Decimal | None:
    try:
        result = Decimal(str(value))
        return result if result.is_finite() else None
    except (InvalidOperation, TypeError, ValueError):
        return None


def _event_properties(event: dict[str, Any]) -> dict[str, Any]:
    properties = event.get("properties")
    return properties if isinstance(properties, dict) else {}


# ---------------------------------------------------------------------------
# Part 1 — Extract
# ---------------------------------------------------------------------------

@task(name="extract_inventory_telemetry_events", retries=3, retry_delay_seconds=5)
def extract_inventory_telemetry_events(
    watermark_from: str,
    watermark_to: str,
) -> dict[str, Any]:
    """Read telemetry and Location dimension without modifying source tables."""
    event_query = text(
        """
        SELECT event_id, event_timestamp, event_type, properties
        FROM public.telemetry_events
        WHERE event_timestamp >= :date_from
          AND event_timestamp < :date_to
          AND event_type IN :event_types
        ORDER BY event_timestamp
        """
    ).bindparams(bindparam("event_types", expanding=True))

    locations_query = text(
        """
        SELECT id, name, city, country, currency
        FROM public."Location"
        ORDER BY id
        """
    )

    with get_source_engine().connect() as connection:
        events = connection.execute(
            event_query,
            {
                "date_from": watermark_from,
                "date_to": watermark_to,
                "event_types": EVENT_TYPES,
            },
        ).mappings().all()
        locations = connection.execute(locations_query).mappings().all()

    records: list[dict[str, Any]] = []
    for item in events:
        record = dict(item)
        raw_event_id = record.get("event_id")
        record["event_id"] = (
            str(raw_event_id) if raw_event_id is not None else None
        )
        raw_timestamp = record.get("event_timestamp")
        if isinstance(raw_timestamp, datetime):
            record["event_timestamp"] = raw_timestamp.isoformat()

        raw_properties = record.get("properties")
        record["properties_invalid"] = not isinstance(raw_properties, dict)
        if not isinstance(raw_properties, dict):
            record["properties"] = {}
        records.append(record)

    return {
        "events": records,
        "locations": [dict(item) for item in locations],
        "rows_extracted": len(records),
        "watermark_from": watermark_from,
        "watermark_to": watermark_to,
    }


# ---------------------------------------------------------------------------
# Part 2 — Transform and validate
# ---------------------------------------------------------------------------
@task(name="validate_weekly_location_events")
def validate_weekly_location_events(
    extracted_data: dict[str, Any],
) -> dict[str, Any]:
    """Validate, deduplicate, and normalize KPI source events."""
    locations = {
        str(item["id"]): item
        for item in extracted_data.get("locations", [])
        if item.get("id") is not None
    }

    validated_events: list[dict[str, Any]] = []
    blocked_location_weeks: set[tuple[str, str]] = set()
    quality_issues: list[str] = []
    quality_warnings: list[str] = []
    seen_event_ids: set[str] = set()
    rows_skipped = 0
    duplicate_event_count = 0
    missing_event_id_count = 0

    for event in extracted_data.get("events", []):
        if not isinstance(event, dict):
            quality_issues.append("Malformed event record: expected an object.")
            continue

        raw_event_id = event.get("event_id")
        if raw_event_id is None or not str(raw_event_id).strip():
            missing_event_id_count += 1
            quality_issues.append("Event rejected because event_id is missing.")
            continue

        event_id = str(raw_event_id).strip()
        if event_id in seen_event_ids:
            duplicate_event_count += 1
            rows_skipped += 1
            quality_warnings.append(f"Duplicate event ignored: {event_id}")
            continue
        seen_event_ids.add(event_id)

        if event.get("properties_invalid"):
            quality_issues.append(
                f"Invalid properties payload for event {event_id}."
            )
            continue

        properties = _event_properties(event)
        event_type = event.get("event_type")

        if event_type not in KPI_EVENT_TYPES:
            rows_skipped += 1
            continue
        if str(properties.get("demo_record", "")).strip().lower() in {
            "true",
            "1",
            "yes",
        }:
            rows_skipped += 1
            quality_warnings.append(f"Demo event excluded: {event_id}")
            continue

        try:
            timestamp = _utc_timestamp(event.get("event_timestamp"))
        except (TypeError, ValueError, OverflowError) as exc:
            quality_issues.append(
                f"Invalid event timestamp for {event_id}: {exc}"
            )
            continue

        week_start = (
            timestamp.date() - timedelta(days=timestamp.weekday())
        ).isoformat()
        location_id = str(properties.get("location_id") or "").strip()
        location = locations.get(location_id)

        if location is None:
            quality_issues.append(
                f"Unknown location: {location_id}, event: {event_id}"
            )
            continue

        grain = (location_id, week_start)
        country = _country_code(location.get("country"))
        currency = str(location.get("currency") or "").strip().upper()
        expected_currency = {"CO": "COP", "US": "USD"}.get(country)

        if expected_currency is None or currency != expected_currency:
            blocked_location_weeks.add(grain)
            quality_issues.append(
                "Invalid country/currency combination for location "
                f"{location_id}: {country}/{currency}"
            )
            continue

        event_country = properties.get("country")
        if event_country not in (None, "") and _country_code(event_country) != country:
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

        total_cost: Decimal | None = None
        if event_type in {"inbound_order_created", "stock_waste_registered"}:
            unit_cost = _to_decimal(properties.get("unit_cost"))
            total_cost = _to_decimal(properties.get("total_cost"))
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

        validated_events.append({
            "event_id": event_id,
            "event_type": event_type,
            "location_id": location_id,
            "week_start": week_start,
            "country": country,
            "currency": currency,
            "total_cost": total_cost,
        })

    return {
        "events": validated_events,
        "blocked_location_weeks": [
            {"location_id": location_id, "week_start": week}
            for location_id, week in sorted(blocked_location_weeks)
        ],
        "quality_issues": quality_issues,
        "quality_warnings": quality_warnings,
        "rows_skipped": rows_skipped,
        "duplicate_event_count": duplicate_event_count,
        "missing_event_id_count": missing_event_id_count,
    }
@task(name="aggregate_weekly_location_metrics")
def aggregate_weekly_location_metrics(
    validated_data: dict[str, Any],
) -> dict[str, Any]:
    """Aggregate validated inventory events by location and week."""
    aggregates: dict[tuple[str, str], dict[str, Any]] = {}
    rows_processed = 0

    for event in validated_data["events"]:
        grain = (event["location_id"], event["week_start"])

        if grain not in aggregates:
            aggregates[grain] = {
                "location_id": event["location_id"],
                "country": event["country"],
                "week_start": event["week_start"],
                "total_purchase_cost": Decimal("0"),
                "total_waste_cost": Decimal("0"),
                "stockout_events_count": 0,
                "price_alert_events_count": 0,
                "currency": event["currency"],
            }

        row = aggregates[grain]
        event_type = event["event_type"]

        if event_type == "inbound_order_created":
            row["total_purchase_cost"] += event["total_cost"]
        elif event_type == "stock_waste_registered":
            row["total_waste_cost"] += event["total_cost"]
        elif event_type == "stock_threshold_triggered":
            row["stockout_events_count"] += 1
        elif event_type == "ingredient_price_variance_detected":
            row["price_alert_events_count"] += 1

        rows_processed += 1

    return {
        "aggregates": list(aggregates.values()),
        "rows_processed": rows_processed,
        **validated_data,
    }


@task(
    name="calculate_weekly_location_kpis",
    cache_key_fn=task_input_hash,
    cache_expiration=timedelta(hours=1),
    persist_result=True,
)
def calculate_weekly_location_kpis(
    aggregated_data: dict[str, Any],
    transform_revision: str = TRANSFORM_REVISION,
) -> dict[str, Any]:
    """Calculate waste ratio and prepare final weekly KPI rows."""
    blocked = {
        (row["location_id"], row["week_start"])
        for row in aggregated_data["blocked_location_weeks"]
    }

    rows: list[dict[str, Any]] = []
    for row in aggregated_data["aggregates"]:
        grain = (row["location_id"], row["week_start"])
        if grain in blocked:
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
        rows.append(row)

    return {
        "rows": sorted(
            rows,
            key=lambda row: (row["week_start"], row["location_id"]),
        ),
        "rows_processed": aggregated_data["rows_processed"],
        "rows_rejected": len(aggregated_data["quality_issues"]),
        "rows_skipped": aggregated_data["rows_skipped"],
        "duplicate_event_count": aggregated_data["duplicate_event_count"],
        "missing_event_id_count": aggregated_data["missing_event_id_count"],
        "quality_issues": aggregated_data["quality_issues"],
        "quality_warnings": aggregated_data["quality_warnings"],
        "blocked_location_weeks": aggregated_data["blocked_location_weeks"],
        "transform_revision": transform_revision,
    }

def build_source_metrics(
    extracted_data: dict[str, Any],
    transformed_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build auditable source-coverage and transformation metrics."""
    event_type_counts = {event_type: 0 for event_type in EVENT_TYPES}
    locations_seen: set[str] = set()
    latest_timestamp: dict[str, dict[str, str]] = {}
    invalid_timestamps = 0
    malformed_properties = 0

    for event in extracted_data.get("events", []):
        if not isinstance(event, dict):
            continue

        event_type = str(event.get("event_type") or "unknown")
        event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1

        properties = event.get("properties")
        if event.get("properties_invalid") or not isinstance(properties, dict):
            malformed_properties += 1
            properties = {}

        location_id = str(properties.get("location_id") or "").strip()
        if not location_id:
            continue
        locations_seen.add(location_id)

        try:
            timestamp = _utc_timestamp(event.get("event_timestamp")).isoformat()
        except (TypeError, ValueError, OverflowError):
            invalid_timestamps += 1
            continue

        location_events = latest_timestamp.setdefault(location_id, {})
        previous = location_events.get(event_type)
        if previous is None or timestamp > previous:
            location_events[event_type] = timestamp

    expected_locations = {
        str(location["id"])
        for location in extracted_data.get("locations", [])
        if location.get("id") is not None
    }

    metrics: dict[str, Any] = {
        "rows_extracted": extracted_data.get(
            "rows_extracted", len(extracted_data.get("events", []))
        ),
        "event_type_counts": event_type_counts,
        "distinct_location_count": len(locations_seen),
        "distinct_locations_seen": sorted(locations_seen),
        "expected_location_count": len(expected_locations),
        "locations_without_events": sorted(expected_locations - locations_seen),
        "max_event_timestamp_by_location_type": latest_timestamp,
        "invalid_timestamp_count": invalid_timestamps,
        "malformed_properties_count": malformed_properties,
        # There is no upstream drop/sequence signal in the supplied source.
        # None means unknown; it must not be reported as zero dropped events.
        "dropped_event_count": None,
        "drop_signal_available": False,
    }

    if transformed_data is not None:
        metrics.update(
            {
                "rows_processed": transformed_data["rows_processed"],
                "rows_rejected": transformed_data["rows_rejected"],
                "rows_skipped": transformed_data["rows_skipped"],
                "duplicate_event_count": transformed_data[
                    "duplicate_event_count"
                ],
                "missing_event_id_count": transformed_data[
                    "missing_event_id_count"
                ],
                "quality_issues": transformed_data["quality_issues"],
                "quality_warnings": transformed_data["quality_warnings"],
                "blocked_location_weeks": transformed_data[
                    "blocked_location_weeks"
                ],
                "transform_revision": transformed_data["transform_revision"],
            }
        )
    return metrics


# ---------------------------------------------------------------------------
# Reporting schema and persistence
# ---------------------------------------------------------------------------

@task(name="ensure_reporting_tables", retries=3, retry_delay_seconds=5)
def ensure_reporting_tables() -> None:
    """Create reporting objects idempotently; also migrate source_metrics."""
    with get_engine().begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS reporting"))
        connection.execute(
            text(
                """
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
                """
            )
        )
        connection.execute(
            text(
                """
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
                    source_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
                    error_summary TEXT,
                    pipeline_version TEXT,
                    trigger_source TEXT
                )
                """
            )
        )
        # Safe migration for reporting.pipeline_runs created by earlier code.
        connection.execute(
            text(
                """
                ALTER TABLE reporting.pipeline_runs
                ADD COLUMN IF NOT EXISTS source_metrics JSONB
                NOT NULL DEFAULT '{}'::jsonb
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at
                ON reporting.pipeline_runs (started_at DESC)
                """
            )
        )


@task(name="upsert_weekly_location_performance", retries=3, retry_delay_seconds=5)
def upsert_weekly_location_performance(
    rows: list[dict[str, Any]],
    blocked_location_weeks: list[dict[str, str]] | None = None,
) -> int:
    """Upsert valid grains and remove previously stored grains now blocked.

    Deletes and inserts are in one transaction: if an upsert fails, the
    deletion of blocked rows is rolled back too.
    """
    blocked_location_weeks = blocked_location_weeks or []
    if not rows and not blocked_location_weeks:
        return 0

    delete_statement = text(
        """
        DELETE FROM reporting.weekly_location_performance
        WHERE location_id = :location_id
          AND week_start = :week_start
        """
    )
    upsert_statement = text(
        """
        INSERT INTO reporting.weekly_location_performance (
            location_id, country, week_start,
            total_purchase_cost, total_waste_cost, waste_ratio,
            stockout_events_count, price_alert_events_count, currency
        )
        VALUES (
            :location_id, :country, :week_start,
            :total_purchase_cost, :total_waste_cost, :waste_ratio,
            :stockout_events_count, :price_alert_events_count, :currency
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
        """
    )

    with get_engine().begin() as connection:
        for blocked in blocked_location_weeks:
            connection.execute(
                delete_statement,
                {
                    "location_id": blocked["location_id"],
                    "week_start": blocked["week_start"],
                },
            )
        for row in rows:
            connection.execute(upsert_statement, row)

    return len(rows)


@task(name="save_pipeline_run", retries=3, retry_delay_seconds=5)
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
    source_metrics: dict[str, Any] | None = None,
    finished_at: datetime | None = None,
    last_completed_stage: str | None = None,
    error_summary: str | None = None,
    trigger_source: str = "schedule",
) -> None:
    """Insert or update the audit row for a Prefect flow run."""
    statement = text(
        """
        INSERT INTO reporting.pipeline_runs (
            run_id, pipeline_name, week_start,
            started_at, finished_at, status, last_completed_stage,
            watermark_from, watermark_to, records_processed,
            rows_extracted, rows_rejected, rows_loaded,
            source_metrics, error_summary, pipeline_version, trigger_source
        )
        VALUES (
            :run_id, :pipeline_name, :week_start,
            :started_at, :finished_at, :status, :last_completed_stage,
            :watermark_from, :watermark_to, :records_processed,
            :rows_extracted, :rows_rejected, :rows_loaded,
            CAST(:source_metrics AS JSONB), :error_summary,
            :pipeline_version, :trigger_source
        )
        ON CONFLICT (run_id)
        DO UPDATE SET
            finished_at = EXCLUDED.finished_at,
            status = EXCLUDED.status,
            last_completed_stage = EXCLUDED.last_completed_stage,
            watermark_from = EXCLUDED.watermark_from,
            watermark_to = EXCLUDED.watermark_to,
            records_processed = EXCLUDED.records_processed,
            rows_extracted = EXCLUDED.rows_extracted,
            rows_rejected = EXCLUDED.rows_rejected,
            rows_loaded = EXCLUDED.rows_loaded,
            source_metrics = EXCLUDED.source_metrics,
            error_summary = EXCLUDED.error_summary,
            pipeline_version = EXCLUDED.pipeline_version,
            trigger_source = EXCLUDED.trigger_source
        """
    )

    with get_engine().begin() as connection:
        connection.execute(
            statement,
            {
                "run_id": run_id,
                "pipeline_name": PIPELINE_NAME,
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
                "source_metrics": json.dumps(source_metrics or {}, default=str),
                "error_summary": error_summary,
                "pipeline_version": os.getenv("GIT_COMMIT_SHA", "local"),
                "trigger_source": trigger_source,
            },
        )


@task(name="save_pipeline_eval_snapshot")
def save_pipeline_eval_snapshot(
    run_id: str,
    transformed: dict[str, Any],
) -> str:
    """Write a local JSON quality snapshot; this is optional observability."""
    eval_dir = ROOT_DIR / "data" / "eval"
    eval_dir.mkdir(parents=True, exist_ok=True)
    output = {
        "run_id": run_id,
        "rows_processed": transformed["rows_processed"],
        "rows_rejected": transformed["rows_rejected"],
        "rows_skipped": transformed["rows_skipped"],
        "duplicate_event_count": transformed["duplicate_event_count"],
        "missing_event_id_count": transformed["missing_event_id_count"],
        "quality_issues": transformed["quality_issues"],
        "quality_warnings": transformed["quality_warnings"],
        "blocked_location_weeks": transformed["blocked_location_weeks"],
        "rows": transformed["rows"],
    }
    output_path = eval_dir / f"pipeline-{run_id}.json"
    output_path.write_text(
        json.dumps(output, indent=2, default=str),
        encoding="utf-8",
    )
    return str(output_path)


# ---------------------------------------------------------------------------
# Reporting read helpers used by the API
# ---------------------------------------------------------------------------


def get_latest_pipeline_run() -> dict[str, Any] | None:
    """Return the most recently started pipeline audit record, if any."""
    with get_engine().connect() as connection:
        table_exists = connection.execute(
            text("SELECT to_regclass('reporting.pipeline_runs')")
        ).scalar_one_or_none()
        if table_exists is None:
            return None
        row = connection.execute(
            text(
                """
                SELECT *
                FROM reporting.pipeline_runs
                ORDER BY started_at DESC
                LIMIT 1
                """
            )
        ).mappings().first()
    return dict(row) if row else None


def get_weekly_location_performance(
    week_start: date | None = None,
    location_id: str | None = None,
    country: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    """Return one week's results; currencies are never added together."""
    limit = max(1, min(int(limit), 500))
    filters: list[str] = []
    params: dict[str, Any] = {"limit": limit}

    if location_id:
        filters.append("location_id = :location_id")
        params["location_id"] = location_id
    if country:
        filters.append("country = :country")
        params["country"] = country.strip().upper()

    with get_engine().connect() as connection:
        table_exists = connection.execute(
            text("SELECT to_regclass('reporting.weekly_location_performance')")
        ).scalar_one_or_none()
        if table_exists is None:
            return {"week_start": week_start, "locations": []}

        if week_start is None:
            latest_where = "WHERE " + " AND ".join(filters) if filters else ""
            latest = connection.execute(
                text(
                    f"""
                    SELECT MAX(week_start)
                    FROM reporting.weekly_location_performance
                    {latest_where}
                    """
                ),
                {key: value for key, value in params.items() if key != "limit"}
                if filters
                else {},
            ).scalar_one_or_none()
            if latest is None:
                return {"week_start": None, "locations": []}
            week_start = latest

        filters.insert(0, "week_start = :week_start")
        params["week_start"] = week_start
        where_clause = "WHERE " + " AND ".join(filters)

        rows = connection.execute(
            text(
                f"""
                SELECT location_id, country, 
                       total_purchase_cost, total_waste_cost, waste_ratio,
                       stockout_events_count, price_alert_events_count,
                       currency
                FROM reporting.weekly_location_performance
                {where_clause}
                ORDER BY location_id
                LIMIT :limit
                """
            ),
            params,
        ).mappings().all()

    return {
        "week_start": week_start,
        "locations": [dict(row) for row in rows],
    }


# ---------------------------------------------------------------------------
# Part 3 — Prefect subflows
# ---------------------------------------------------------------------------

@flow(name="extract_inventory_telemetry_subflow")
def extract_inventory_telemetry_subflow(
    watermark_from: str,
    watermark_to: str,
) -> dict[str, Any]:
    return extract_inventory_telemetry_events(watermark_from, watermark_to)


@flow(name="transform_weekly_location_kpis_subflow")
def transform_weekly_location_kpis_subflow(
    extracted: dict[str, Any],
) -> dict[str, Any]:
    return aggregate_weekly_location_kpis(extracted, TRANSFORM_REVISION)


@flow(name="load_weekly_location_performance_subflow")
def load_weekly_location_performance_subflow(
    transformed: dict[str, Any],
) -> int:
    return upsert_weekly_location_performance(
        transformed["rows"],
        transformed["blocked_location_weeks"],
    )


# ---------------------------------------------------------------------------
# Main orchestration flow
# ---------------------------------------------------------------------------

@flow(name="weekly_location_cost_waste_flow")
def weekly_location_cost_waste_flow(
    week_start: str | None = None,
    trigger_source: str = "schedule",
    run_id: str | None = None,
) -> dict[str, Any]:
    """Run the four-week correction window for one target reporting week."""
    now = datetime.now(timezone.utc)
    current_monday = now.date() - timedelta(days=now.weekday())
    target_week = (
        date.fromisoformat(week_start)
        if week_start
        else current_monday - timedelta(days=7)
    )
    if target_week.weekday() != 0:
        raise ValueError("week_start must be a Monday.")

    # The query covers the target week plus the three previous full weeks.
    watermark_from = datetime.combine(
        target_week - timedelta(weeks=CORRECTION_WINDOW_WEEKS - 1),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )
    watermark_to = datetime.combine(
        target_week + timedelta(days=7),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )

    run_id = run_id or str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    source_metrics: dict[str, Any] = {}
    extracted: dict[str, Any] | None = None
    transformed: dict[str, Any] | None = None
    rows_loaded = 0
    last_completed_stage = "start"
    logger = get_run_logger()

    try:
        # Include lock acquisition, table setup, and the initial audit write in
        # the failure boundary so startup failures are logged by Prefect too.
        with postgres_reporting_window_advisory_lock(target_week):
            ensure_reporting_tables()
            save_pipeline_run(
                run_id=run_id,
                week_start=target_week.isoformat(),
                started_at=started_at,
                status="running",
                watermark_from=watermark_from,
                watermark_to=watermark_to,
                source_metrics={"stage": "started"},
                trigger_source=trigger_source,
            )

            extraction_state = extract_inventory_telemetry_subflow(
                watermark_from.isoformat(),
                watermark_to.isoformat(),
                return_state=True,
            )
            if extraction_state.is_failed():
                raise RuntimeError(
                    f"Extraction failed: {extraction_state.message}"
                )

            extracted = extraction_state.result()
            last_completed_stage = "extract"
            source_metrics = build_source_metrics(extracted)

            validated = validate_weekly_location_events(extracted)
            aggregated = aggregate_weekly_location_metrics(validated)
            transformed = calculate_weekly_location_kpis(aggregated, TRANSFORM_REVISION)
            last_completed_stage = "transform"
            source_metrics = build_source_metrics(extracted, transformed)

            # This local quality snapshot is optional. Its failure is recorded
            # in Prefect but must not prevent the reporting data from loading.
            snapshot_state = save_pipeline_eval_snapshot(
                run_id,
                transformed,
                return_state=True,
            )
            if snapshot_state.is_failed():
                logger.warning(
                    "Optional evaluation snapshot failed; continuing with "
                    "the reporting load. run_id=%s error=%s",
                    run_id,
                    snapshot_state.message,
                )

            load_state = load_weekly_location_performance_subflow(
                transformed,
                return_state=True,
            )
            if load_state.is_failed():
                raise RuntimeError(f"Loading failed: {load_state.message}")

            rows_loaded = load_state.result()
            last_completed_stage = "load"
            status = "partial" if transformed["rows_rejected"] else "completed"
            error_summary = "; ".join(transformed["quality_issues"]) or None

            save_pipeline_run(
                run_id=run_id,
                week_start=target_week.isoformat(),
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                status=status,
                last_completed_stage=last_completed_stage,
                watermark_from=watermark_from,
                watermark_to=watermark_to,
                records_processed=transformed["rows_processed"],
                rows_extracted=extracted["rows_extracted"],
                rows_rejected=transformed["rows_rejected"],
                rows_loaded=rows_loaded,
                source_metrics=source_metrics,
                error_summary=error_summary,
                trigger_source=trigger_source,
            )

            return {
                "status": status,
                "run_id": run_id,
                "week_start": target_week.isoformat(),
                "watermark_from": watermark_from.isoformat(),
                "watermark_to": watermark_to.isoformat(),
                "rows_processed": transformed["rows_processed"],
                "rows_rejected": transformed["rows_rejected"],
                "rows_loaded": rows_loaded,
                "source_metrics": source_metrics,
            }

    except Exception as exc:
        # Prefect keeps this structured exception even if the reporting DB is
        # unavailable and cannot persist the run audit row.
        logger.exception(
            "Business reporting pipeline failed. run_id=%s week_start=%s "
            "last_completed_stage=%s",
            run_id,
            target_week.isoformat(),
            last_completed_stage,
        )
        try:
            # This also handles a transient startup failure after the database
            # becomes available. If the schema/database is still unavailable,
            # the following exception is logged and the original is re-raised.
            ensure_reporting_tables()
            save_pipeline_run(
                run_id=run_id,
                week_start=target_week.isoformat(),
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                status="failed",
                last_completed_stage=last_completed_stage,
                watermark_from=watermark_from,
                watermark_to=watermark_to,
                records_processed=(
                    transformed["rows_processed"] if transformed else 0
                ),
                rows_extracted=(
                    extracted["rows_extracted"] if extracted else 0
                ),
                rows_rejected=(
                    transformed["rows_rejected"] if transformed else 0
                ),
                rows_loaded=rows_loaded,
                source_metrics=source_metrics,
                error_summary=str(exc),
                trigger_source=trigger_source,
            )
        except Exception:
            logger.exception(
                "Could not persist failed pipeline audit record. run_id=%s",
                run_id,
            )
        raise

def trigger_weekly_location_cost_waste_flow(
    week_start: str | None = None,
    trigger_source: str = "manual",
    run_id: str | None = None,
) -> dict[str, Any]:
    """Stable callable for the API layer and deployment tooling."""
    return weekly_location_cost_waste_flow(
        week_start=week_start,
        trigger_source=trigger_source,
        run_id=run_id,
    )


if __name__ == "__main__":
    weekly_location_cost_waste_flow()
