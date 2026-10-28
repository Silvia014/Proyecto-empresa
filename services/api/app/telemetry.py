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
    # Mandatory business events
    "inbound_order_created",
    "outbound_order_created",
    "stock_waste_registered",
    "stock_threshold_triggered",
    "direct_stock_edit_rejected",
    "ingredient_price_variance_detected",
    # Inventory and supplier operations
    "inbound_order_validation_failed",
    "outbound_order_validation_failed",
    "inventory_order_submitted",
    "inventory_flow_abandoned",
    "minimum_stock_alert_acknowledged",
    "supplier_delivery_recorded",
    "supplier_price_updated",
    "inventory_threshold_configuration_changed",
    # Authentication and security
    "login_succeeded",
    "login_failed",
    "session_expired",
    "permission_denied",
    # Performance and telemetry pipeline
    "api_request_completed",
    "api_request_failed",
    "database_operation_slow",
    "frontend_action_failed",
    "frontend_route_viewed",
    "frontend_flow_step_completed",
    "frontend_flow_abandoned",
    "telemetry_event_dropped",
    "telemetry_schema_validation_failed",
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

    # Validate each event independently so one malformed event does not
    # discard otherwise valid events from the batch.
    for raw_event in raw_events:
        try:
            valid_events.append(TelemetryEvent.model_validate(raw_event))
        except ValidationError:
            rejected += 1

    stored = 0
    try:
        if valid_events:
            with Session(engine) as session:
                for event in valid_events:
                    result = session.execute(
                        INSERT_EVENT,
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
                        },
                    )
                    # ON CONFLICT DO NOTHING means duplicate event IDs are
                    # received but are not counted as newly stored.
                    stored += max(result.rowcount or 0, 0)
                session.commit()
    except Exception as exc:
        logger.exception("Failed to persist telemetry batch")
        raise HTTPException(
            status_code=503,
            detail="Telemetry storage is temporarily unavailable",
        ) from exc

    if rejected:
        record_internal_event(
            "telemetry_schema_validation_failed",
            None,
            {
                "rejected_count": rejected,
                "received_count": len(raw_events),
                "source": "telemetry_events_endpoint",
            },
        )

    return {
        "received": len(raw_events),
        "stored": stored,
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
