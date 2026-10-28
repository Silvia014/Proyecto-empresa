from datetime import datetime
from typing import Any, List, Optional

import pandas as pd
from sqlalchemy import bindparam, text
from sqlmodel import Session

from app.database import engine


def _load_events(
    start_date: datetime,
    end_date: datetime,
    event_types: Optional[List[str]] = None,
) -> pd.DataFrame:
    """Load telemetry events from Supabase for a UTC date range."""

    query = """
        SELECT
            event_timestamp AS timestamp,
            event_type,
            properties AS tags
        FROM public.telemetry_events
        WHERE event_timestamp >= :start_date
          AND event_timestamp < :end_date
    """

    statement = text(query)
    params: dict[str, Any] = {
        "start_date": start_date,
        "end_date": end_date,
    }

    if event_types:
        statement = text(
        query + " AND event_type IN :event_types"
    ).bindparams(
        bindparam("event_types", expanding=True)
    )
    params["event_types"] = event_types

    with Session(engine) as session:
        rows = session.execute(statement, params).mappings().all()

    df = pd.DataFrame(
        rows,
        columns=["timestamp", "event_type", "tags"],
    )

    if df.empty:
        return df.assign(
            date=pd.Series(dtype="datetime64[ns, UTC]")
        )

    # Convert timestamps before any temporal grouping.
    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        utc=True,
        errors="coerce",
    )

    df = df.dropna(subset=["timestamp", "event_type"]).copy()

    df["date"] = df["timestamp"].dt.floor("D")

    df["tags"] = df["tags"].map(
        lambda value: value if isinstance(value, dict) else {}
    )

    return df


def events_per_day(
    start_date: datetime,
    end_date: datetime,
) -> list[dict[str, Any]]:
    """Count events by UTC day and event type."""

    df = _load_events(start_date, end_date)

    if df.empty:
        return []

    result = (
        df.groupby(["date", "event_type"])
        .agg(event_count=("event_type", "count"))
        .reset_index()
    )

    result["date"] = result["date"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    return result.to_dict(orient="records")


def error_rate_by_type(
    start_date: datetime,
    end_date: datetime,
) -> list[dict[str, Any]]:
    """Calculate the error rate for each relevant event type."""

    error_types = [
        "api_request_failed",
        "login_failed",
        "frontend_action_failed",
        "inbound_order_validation_failed",
        "outbound_order_validation_failed",
        "telemetry_schema_validation_failed",
    ]

    relevant_types = error_types + ["api_request_completed"]

    df = _load_events(start_date, end_date, relevant_types)

    if df.empty:
        return []

    df["is_error"] = df["event_type"].isin(error_types)

    result = (
        df.groupby("event_type")
        .agg(
            event_count=("event_type", "count"),
            error_count=("is_error", "sum"),
        )
        .reset_index()
    )

    result["error_rate"] = (
        result["error_count"] / result["event_count"]
    ).round(4)

    return result.to_dict(orient="records")


def api_latency_by_day(
    start_date: datetime,
    end_date: datetime,
) -> list[dict[str, Any]]:
    """Calculate API response latency by UTC day and route."""

    df = _load_events(
        start_date,
        end_date,
        ["api_request_completed"],
    )

    if df.empty:
        return []

    df["route_template"] = df["tags"].map(
        lambda tags: tags.get("route_template")
    )

    df["duration_ms"] = pd.to_numeric(
        df["tags"].map(lambda tags: tags.get("duration_ms")),
        errors="coerce",
    )

    df = df.dropna(
        subset=["route_template", "duration_ms"]
    )

    if df.empty:
        return []

    result = (
        df.groupby(["date", "route_template"])
        .agg(
            request_count=("duration_ms", "count"),
            mean_duration_ms=("duration_ms", "mean"),
            max_duration_ms=("duration_ms", "max"),
        )
        .reset_index()
    )

    result["date"] = result["date"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    result["mean_duration_ms"] = result["mean_duration_ms"].round(2)

    return result.to_dict(orient="records")


def event_volume_by_type(
    start_date: datetime,
    end_date: datetime,
) -> list[dict[str, Any]]:
    """Calculate total event volume and share by event type."""

    df = _load_events(start_date, end_date)

    if df.empty:
        return []

    result = (
        df.groupby("event_type")
        .agg(event_count=("event_type", "count"))
        .reset_index()
    )

    total_events = result["event_count"].sum()

    result["share"] = (
        result["event_count"] / total_events
    ).round(4)

    return result.sort_values(
        "event_count",
        ascending=False,
    ).to_dict(orient="records")