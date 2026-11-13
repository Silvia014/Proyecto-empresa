import logging
import time

from celery import Task
from sqlalchemy import text

from services.api.app.database import engine
from services.celery_app import celery_app
from data.pipelines.pipeline import trigger_weekly_location_cost_waste_flow

logger = logging.getLogger("services.celery")


class DeadLetterTask(Task):
    """Record a task after it exhausts its automatic retries."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        attempt_number = self.request.retries + 1

        logger.error(
            "task_id=%s attempt=%s status=failure error=%s",
            task_id,
            attempt_number,
            exc,
        )

        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        INSERT INTO public.celery_dead_letters
                            (task_id, task_name, attempt_number, error_message)
                        VALUES
                            (:task_id, :task_name, :attempt_number, :error_message)
                        ON CONFLICT (task_id) DO UPDATE
                        SET attempt_number = EXCLUDED.attempt_number,
                            error_message = EXCLUDED.error_message,
                            failed_at = now()
                        """
                    ),
                    {
                        "task_id": task_id,
                        "task_name": self.name,
                        "attempt_number": attempt_number,
                        "error_message": str(exc)[:8000],
                    },
                )
        except Exception:
            logger.exception(
                "Could not persist dead-letter record for task_id=%s",
                task_id,
            )


@celery_app.task(
    bind=True,
    base=DeadLetterTask,
    name="services.tasks.run_weekly_business_report",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=3,
)
def run_weekly_business_report(self, week_start: str | None = None):
    task_id = self.request.id or "unknown"
    attempt_number = self.request.retries + 1
    started = time.monotonic()

    logger.info(
        "task_id=%s attempt=%s status=started",
        task_id,
        attempt_number,
    )

    try:
        result = trigger_weekly_location_cost_waste_flow(
            week_start=week_start,
            trigger_source="manual",
            run_id=task_id,
        )
    except Exception as exc:
        duration_seconds = round(time.monotonic() - started, 2)
        status = (
            "failure"
            if self.request.retries >= self.max_retries
            else "retrying"
        )
        logger.exception(
            "task_id=%s attempt=%s status=%s duration_seconds=%s error=%s",
            task_id,
            attempt_number,
            status,
            duration_seconds,
            exc,
        )
        raise

    duration_seconds = round(time.monotonic() - started, 2)
    logger.info(
        "task_id=%s attempt=%s status=success duration_seconds=%s",
        task_id,
        attempt_number,
        duration_seconds,
    )
    return result
