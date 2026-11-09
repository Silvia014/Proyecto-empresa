"""Persistence and state transitions for scheduled background jobs.

``public.job_runs`` is the sole distributed lock for a job/date pair. A row in
``processing`` prevents a second process from claiming the same work.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal
from uuid import UUID

from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError

JobStatus = Literal["pending", "processing", "completed", "failed"]


@dataclass(frozen=True)
class JobClaim:
    run_id: UUID
    status: JobStatus
    should_run: bool


def create_job_run(engine: Engine, job_name: str, target_date: date) -> UUID:
    """Create the pending ledger row, or return the row for this job/date."""
    with engine.begin() as connection:
        inserted_id = connection.execute(
            text(
                """
                INSERT INTO public.job_runs (job_name, target_date, status)
                VALUES (:job_name, :target_date, 'pending')
                ON CONFLICT (job_name, target_date) DO NOTHING
                RETURNING id
                """
            ),
            {"job_name": job_name, "target_date": target_date},
        ).scalar_one_or_none()
        if inserted_id is not None:
            return inserted_id

        return connection.execute(
            text(
                """
                SELECT id
                FROM public.job_runs
                WHERE job_name = :job_name AND target_date = :target_date
                """
            ),
            {"job_name": job_name, "target_date": target_date},
        ).scalar_one()


def get_job_run(engine: Engine, run_id: UUID) -> dict[str, object] | None:
    """Return a job run for operational inspection, if it exists."""
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT * FROM public.job_runs WHERE id = :run_id"),
            {"run_id": run_id},
        ).mappings().one_or_none()
    return dict(row) if row is not None else None


def has_processing_lock(engine: Engine, job_name: str) -> bool:
    """Report whether any date for this job currently owns the processing lock.

    This is an observation helper. Claiming must still use ``claim_job_run``
    because it takes a row lock and changes the state atomically.
    """
    with engine.connect() as connection:
        return bool(
            connection.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM public.job_runs
                        WHERE job_name = :job_name
                          AND status = 'processing'
                    )
                    """
                ),
                {"job_name": job_name},
            ).scalar_one()
        )


def has_completed_for_date(engine: Engine, job_name: str, target_date: date) -> bool:
    """Report whether this job/date has already completed successfully."""
    with engine.connect() as connection:
        return bool(
            connection.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM public.job_runs
                        WHERE job_name = :job_name
                          AND target_date = :target_date
                          AND status = 'completed'
                    )
                    """
                ),
                {"job_name": job_name, "target_date": target_date},
            ).scalar_one()
        )


def claim_job_run(engine: Engine, job_name: str, target_date: date) -> JobClaim:
    """Create/claim a job. Completed dates are idempotent; processing locks.

    The pending insert is committed separately so the lifecycle is observable
    before work begins. The following row lock serializes competing claimants.
    A failed run can be retried for the same target date.
    """
    run_id = create_job_run(engine, job_name, target_date)

    try:
        with engine.begin() as connection:
            row = connection.execute(
                text(
                    """
                    SELECT id, status
                    FROM public.job_runs
                    WHERE id = :run_id
                    FOR UPDATE
                    """
                ),
                {"run_id": run_id},
            ).mappings().one()
            run_id = row["id"]
            status = row["status"]

            if status in {"processing", "completed"}:
                return JobClaim(run_id, status, False)

            active_run_id = connection.execute(
                text(
                    """
                    SELECT id
                    FROM public.job_runs
                    WHERE job_name = :job_name AND status = 'processing'
                    LIMIT 1
                    FOR UPDATE
                    """
                ),
                {"job_name": job_name},
            ).scalar_one_or_none()
            if active_run_id is not None:
                return JobClaim(active_run_id, "processing", False)

            connection.execute(
                text(
                    """
                    UPDATE public.job_runs
                    SET status = 'processing',
                        started_at = now(),
                        finished_at = NULL,
                        records_processed = 0,
                        error_message = NULL
                    WHERE id = :run_id
                    """
                ),
                {"run_id": run_id},
            )
            return JobClaim(run_id, "processing", True)
    except IntegrityError:
        # Concurrent claims for different dates can both observe no current
        # processing row. The unique partial index below makes one winner; the
        # loser returns the winner's row as a clean, non-error skip.
        with engine.connect() as connection:
            active_run_id = connection.execute(
                text(
                    """
                    SELECT id
                    FROM public.job_runs
                    WHERE job_name = :job_name AND status = 'processing'
                    LIMIT 1
                    """
                ),
                {"job_name": job_name},
            ).scalar_one_or_none()
        if active_run_id is None:
            raise
        return JobClaim(active_run_id, "processing", False)


def complete_job_run(engine: Engine, run_id: UUID, records_processed: int) -> None:
    """Transition a claimed job to completed."""
    _finish_job_run(
        engine,
        run_id,
        status="completed",
        records_processed=records_processed,
        error_message=None,
    )


def fail_job_run(
    engine: Engine,
    run_id: UUID,
    error_message: str,
    records_processed: int,
) -> None:
    """Transition a claimed job to failed, retaining a useful error summary."""
    _finish_job_run(
        engine,
        run_id,
        status="failed",
        records_processed=records_processed,
        error_message=error_message[:8000],
    )


def _finish_job_run(
    engine: Engine,
    run_id: UUID,
    *,
    status: Literal["completed", "failed"],
    records_processed: int,
    error_message: str | None,
) -> None:
    with engine.begin() as connection:
        result = connection.execute(
            text(
                """
                UPDATE public.job_runs
                SET status = :status,
                    finished_at = now(),
                    records_processed = :records_processed,
                    error_message = :error_message
                WHERE id = :run_id AND status = 'processing'
                """
            ),
            {
                "run_id": run_id,
                "status": status,
                "records_processed": records_processed,
                "error_message": error_message,
            },
        )
        if result.rowcount != 1:
            raise RuntimeError(
                f"Could not transition job run {run_id} from processing to {status}."
            )
