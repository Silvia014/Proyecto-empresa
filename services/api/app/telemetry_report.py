
from datetime import datetime, timedelta, timezone
from typing import Any
import time
from threading import Lock

from fastapi import APIRouter, HTTPException, Query

from services.telemetry.analysis import (
    api_latency_by_day,
    error_rate_by_type,
    event_volume_by_type,
    events_per_day,
)

router = APIRouter(prefix="/telemetry", tags=["Telemetry Report"])

CACHE_TTL = 60

_report_cache: dict[tuple[str, str], dict] = {}
_cache_lock = Lock()


@router.get("/report")
def get_telemetry_report(
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
) -> dict[str, Any]:
    """Return technical telemetry metrics for a selected UTC period."""

    now = datetime.now(timezone.utc)

    end = end_date or now
    start = start_date or (end - timedelta(days=7))

    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    start = start.astimezone(timezone.utc)
    end = end.astimezone(timezone.utc)

    if start >= end:
        raise HTTPException(
            status_code=400,
            detail="start_date must be earlier than end_date",
        )

    # Check whether this date range has a valid cached report.
    cache_key = (start.isoformat(), end.isoformat())
    now_timestamp = time.monotonic()

    with _cache_lock:
        cached = _report_cache.get(cache_key)

        if (
            cached is not None
            and now_timestamp - cached["created_at"] < CACHE_TTL
        ):
            return cached["report"]

    # Calculate metrics outside the endpoint's cache lock.
    report = {
        "period": {
            "from": start.isoformat(),
            "to": end.isoformat(),
        },
        "metrics": {
            "events_per_day": events_per_day(start, end),
            "error_rate_by_type": error_rate_by_type(start, end),
            "api_latency_by_day": api_latency_by_day(start, end),
            "event_volume_by_type": event_volume_by_type(start, end),
        },
    }

    with _cache_lock:
        _report_cache[cache_key] = {
            "created_at": time.monotonic(),
            "report": report,
        }

    return report
