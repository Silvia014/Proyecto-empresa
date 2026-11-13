import os

from celery import Celery


broker_url = os.getenv(
    "CELERY_BROKER_URL",
    "redis://localhost:6379/0",
)
result_backend = os.getenv(
    "CELERY_RESULT_BACKEND",
    "redis://localhost:6379/1",
)

celery_app = Celery(
    "brasaland",
    broker=broker_url,
    backend=result_backend,
    include=["services.tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,

    task_soft_time_limit=540,
    task_time_limit=600,
    result_expires=86400,

    enable_utc=True,
    timezone="UTC",
    broker_connection_retry_on_startup=True,

    worker_send_task_events=True,
    task_send_sent_event=True,
)

