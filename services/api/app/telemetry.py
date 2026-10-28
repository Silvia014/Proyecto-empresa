import json
import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import text
from sqlmodel import Session

from .database import engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

EventType = Literal[
    "inbound_order_created",
    "outbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "direct_stock_edit_rejected",
    "ingredient_price_variance_detected",
]


class TelemetryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eventId: UUID
    sessionId: str = Field(min_length=1)
    userId: Optional[str] = None
    timestamp: datetime
    event_type: EventType
    schemaVersion: str = Field(min_length=1)
    requestId: str = Field(min_length=1)
    properties: dict[str, Any]


class TelemetryBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[TelemetryEvent] = Field(min_length=1, max_length=100)


INSERT_EVENT = text("""
    INSERT INTO public.telemetry_events (
        event_id,
        session_id,
        user_id,
        event_timestamp,
        event_type,
        schema_version,
        request_id,
        properties
    )
    VALUES (
        :event_id,
        :session_id,
        :user_id,
        :event_timestamp,
        :event_type,
        :schema_version,
        :request_id,
        CAST(:properties AS JSONB)
    )
    ON CONFLICT (event_id) DO NOTHING
""")


def _persist_event(
    event_type: str,
    user_id: Optional[str],
    properties: dict[str, Any],
    *,
    session_id: Optional[str] = None,
    event_id: Optional[UUID] = None,
    timestamp: Optional[datetime] = None,
    request_id: Optional[str] = None,
) -> None:
    import json

    event = {
        "event_id": str(event_id or uuid4()),
        "session_id": session_id or f"backend-{uuid4()}",
        "user_id": user_id,
        "event_timestamp": timestamp or datetime.now(timezone.utc),
        "event_type": event_type,
        "schema_version": "1.0",
        "request_id": request_id or str(uuid4()),
        "properties": json.dumps(properties, default=str),
    }

    with Session(engine) as session:
        session.execute(INSERT_EVENT, event)
        session.commit()


@router.post("/events", status_code=200)
def receive_telemetry(batch: dict[str, Any]):
    raw_events = batch.get("events")

    if not isinstance(raw_events, list):
        raise HTTPException(
            status_code=400,
            detail="The request must contain an events array",
        )

    valid_events = []
    rejected = 0

    # Validate each event independently.
    for raw_event in raw_events:
        try:
            event = TelemetryEvent.model_validate(raw_event)
            valid_events.append(event)
        except ValidationError:
            rejected += 1

    # Persist all valid events in one transaction.
    try:
        if valid_events:
            with Session(engine) as session:
                session.execute(
                    INSERT_EVENT,
                    [
                        {
                            "event_id": str(event.eventId),
                            "session_id": event.sessionId,
                            "user_id": event.userId,
                            "event_timestamp": event.timestamp,
                            "event_type": event.event_type,
                            "schema_version": event.schemaVersion,
                            "request_id": event.requestId,
                            "properties": json.dumps(
                                event.properties,
                                default=str,
                            ),
                        }
                        for event in valid_events
                    ],
                )
                session.commit()

    except Exception as exc:
        logger.exception("Failed to persist telemetry batch")
        raise HTTPException(
            status_code=503,
            detail="Telemetry storage is temporarily unavailable",
        ) from exc

    return {
        "received": len(raw_events),
        "stored": len(valid_events),
        "rejected": rejected,
    }

def record_internal_event(
    event_type: str,
    user_id: Optional[str],
    properties: dict[str, Any],
    session_id: Optional[str] = None,
) -> None:
    """Persist a backend-generated telemetry event without breaking business logic."""
    try:
        _persist_event(
            event_type,
            user_id,
            properties,
            session_id=session_id,
        )
    except Exception:
        logger.exception(
            "Failed to persist internal telemetry event: %s",
            event_type,
        )
