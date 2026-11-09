#!/usr/bin/env python3
"""Export yesterday's telemetry and run the existing business ETL.

This is an independent command-line worker. It is scheduled by GitHub Actions
and never runs in the FastAPI request process. The CSV is an audit/recovery
snapshot only; the weekly pipeline continues reading telemetry directly from
the database.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import subprocess
import sys
import time
from datetime import date, datetime, time as datetime_time, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

ROOT_DIR = Path(__file__).resolve().parents[1]
# Executing a file under ``scripts/`` puts that directory, not the repository
# root, on sys.path. Add the root explicitly so ``services.job_runner`` and
# ``data.pipelines`` imports work the same locally and in GitHub Actions.
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

JOB_NAME = "nightly_export"
LOGGER = logging.getLogger("nightly_export")


class UTCFormatter(logging.Formatter):
    converter = time.gmtime


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(
        UTCFormatter("%(asctime)sZ %(levelname)s job=nightly_export %(message)s")
    )
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)


def _database_engine(database_url: str | None, label: str) -> Engine:
    if not database_url:
        raise RuntimeError(
            f"{label} database URL is missing. Set {label} or DATABASE_URL."
        )
    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10},
    )


def _job_runs_engine() -> Engine:
    url = (
        os.getenv("JOB_RUNS_DATABASE_URL")
        or os.getenv("REPORTING_DATABASE_URL")
        or os.getenv("DATABASE_URL")
    )
    return _database_engine(url, "JOB_RUNS_DATABASE_URL")


def _source_engine() -> Engine:
    url = os.getenv("SOURCE_DATABASE_URL") or os.getenv("DATABASE_URL")
    return _database_engine(url, "SOURCE_DATABASE_URL")


def resolve_target_date(cli_value: str | None = None) -> date:
    value = cli_value or os.getenv("TARGET_DATE")
    if value:
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("TARGET_DATE must use YYYY-MM-DD format.") from exc
    return datetime.now(timezone.utc).date() - timedelta(days=1)


def _csv_value(value: Any) -> Any:
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, default=str)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _count_csv_records(csv_path: Path) -> int:
    with csv_path.open("r", newline="", encoding="utf-8") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def export_telemetry_csv(
    source_engine: Engine,
    target_date: date,
    output_dir: Path | None = None,
) -> tuple[Path, int, bool]:
    """Export one UTC calendar day; an existing snapshot is never overwritten."""
    output_dir = output_dir or ROOT_DIR / "data" / "raw"
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"telemetry_{target_date.isoformat()}.csv"

    if csv_path.exists():
        return csv_path, _count_csv_records(csv_path), False

    start_at = datetime.combine(target_date, datetime_time.min, tzinfo=timezone.utc)
    end_at = start_at + timedelta(days=1)
    temporary_path: Path | None = None

    try:
        with source_engine.begin() as connection:
            connection.execute(text("SET TRANSACTION READ ONLY"))
            connection.execute(text("SET LOCAL statement_timeout = '30min'"))
            result = connection.execution_options(stream_results=True).execute(
                text(
                    """
                    SELECT *
                    FROM public.telemetry_events
                    WHERE event_timestamp >= :start_at
                      AND event_timestamp < :end_at
                    ORDER BY event_timestamp, event_id
                    """
                ),
                {"start_at": start_at, "end_at": end_at},
            )
            fieldnames = list(result.keys())
            row_count = 0
            temporary_path = csv_path.with_name(f".{csv_path.name}.{os.getpid()}.tmp")
            with temporary_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                for row in result.mappings():
                    writer.writerow({key: _csv_value(value) for key, value in row.items()})
                    row_count += 1
                handle.flush()
                os.fsync(handle.fileno())

        # Atomic publish keeps interrupted exports from appearing complete.
        os.replace(temporary_path, csv_path)
        return csv_path, row_count, True
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def run_pipeline(target_date: date) -> None:
    """Run the existing ETL entrypoint in a separate Python process."""
    environment = os.environ.copy()
    environment["TARGET_DATE"] = target_date.isoformat()
    timeout_seconds = int(os.getenv("NIGHTLY_PIPELINE_TIMEOUT_SECONDS", "3000"))
    subprocess.run(
        [sys.executable, "-m", "data.pipelines.pipeline"],
        cwd=ROOT_DIR,
        env=environment,
        check=True,
        timeout=timeout_seconds,
    )


def execute(target_date: date) -> int:
    from services.job_runner import (
        claim_job_run,
        complete_job_run,
        fail_job_run,
    )

    job_engine: Engine | None = None
    source_engine: Engine | None = None
    run_id: UUID | None = None
    records_processed = 0
    try:
        job_engine = _job_runs_engine()
        claim = claim_job_run(job_engine, JOB_NAME, target_date)
        run_id = claim.run_id
        if not claim.should_run:
            LOGGER.info(
                "state=skipped target_date=%s run_id=%s reason=%s",
                target_date,
                run_id,
                "already_completed" if claim.status == "completed" else "already_processing",
            )
            return 0

        LOGGER.info("state=started target_date=%s run_id=%s", target_date, run_id)
        source_engine = _source_engine()
        csv_path, records_processed, created = export_telemetry_csv(
            source_engine, target_date
        )
        LOGGER.info(
            "state=exported target_date=%s run_id=%s records=%d csv=%s created=%s",
            target_date,
            run_id,
            records_processed,
            csv_path.relative_to(ROOT_DIR),
            created,
        )

        LOGGER.info("state=pipeline_started target_date=%s run_id=%s", target_date, run_id)
        run_pipeline(target_date)
        complete_job_run(job_engine, run_id, records_processed)
        LOGGER.info(
            "state=completed target_date=%s run_id=%s records_processed=%d",
            target_date,
            run_id,
            records_processed,
        )
        return 0
    except BaseException as exc:
        if run_id is not None and job_engine is not None:
            try:
                fail_job_run(job_engine, run_id, str(exc), records_processed)
            except Exception:
                LOGGER.exception(
                    "state=failed_status_persist_error target_date=%s run_id=%s",
                    target_date,
                    run_id,
                )
        LOGGER.exception(
            "state=failed target_date=%s run_id=%s records_processed=%d error=%s",
            target_date,
            run_id or "unclaimed",
            records_processed,
            exc,
        )
        raise
    finally:
        if source_engine is not None:
            source_engine.dispose()
        if job_engine is not None:
            job_engine.dispose()


def main() -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--target-date",
        help="UTC date to export (YYYY-MM-DD); overrides TARGET_DATE.",
    )
    args = parser.parse_args()
    target_date = resolve_target_date(args.target_date)
    return execute(target_date)


if __name__ == "__main__":
    raise SystemExit(main())
