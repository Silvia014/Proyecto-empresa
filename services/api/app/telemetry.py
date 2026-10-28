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
    sessionId: Optional[str] = None
    userId: Optional[str] = None
    timestamp: datetime
    event_type: EventType
    schemaVersion: str = Field(min_length=1)
    requestId: Optional[str] = None
    properties: dict[str, Any]


class TelemetryBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[TelemetryEvent] = Field(min_length=1, max_length=100)


# Closed property allowlists from the telemetry plan. Keep personal data,
# credentials, full URLs, and request/response bodies out of telemetry.
EVENT_PROPERTY_ALLOWLIST: dict[str, set[str]] = {
    "inbound_order_created": {
        "location_id", "country", "product_id", "product_category", "quantity",
        "unit", "currency", "supplier_id", "order_id", "unit_cost", "total_cost",
    },
    "outbound_order_created": {
        "location_id", "country", "product_id", "product_category", "quantity",
        "unit", "currency", "order_id", "reason",
    },
    "stock_waste_registered": {
        "location_id", "country", "product_id", "product_category", "quantity",
        "unit", "currency", "reason", "order_id",
    },
    "stock_threshold_triggered": {
        "location_id", "country", "product_id", "product_category", "quantity",
        "unit", "currency", "threshold_quantity",
    },
    "direct_stock_edit_rejected": {
        "location_id", "country", "product_id", "product_category", "quantity",
        "unit", "currency", "rejection_code", "source",
    },
    "ingredient_price_variance_detected": {
        "location_id", "country", "product_id", "product_category", "quantity",
        "unit", "currency", "supplier_id", "current_unit_cost",
        "reference_unit_cost", "variance_percent", "threshold_percent",
    },
    "inbound_order_validation_failed": {
        "location_id", "country", "product_id", "validation_code", "field_name", "source",
    },
    "outbound_order_validation_failed": {
        "location_id", "country", "product_id", "validation_code",
        "requested_quantity", "available_quantity", "unit",
    },
    "inventory_order_submitted": {"order_kind", "location_id", "country", "source"},
    "inventory_flow_abandoned": {"flow_name", "last_step", "elapsed_seconds", "source"},
    "minimum_stock_alert_acknowledged": {
        "location_id", "country", "product_id", "alert_age_seconds", "acknowledgement_channel",
    },
    "supplier_delivery_recorded": {
        "location_id", "country", "supplier_id", "order_id", "expected_at",
        "received_at", "delivery_status",
    },
    "supplier_price_updated": {
        "supplier_id", "product_id", "country", "currency", "previous_unit_cost",
        "new_unit_cost", "effective_at",
    },
    "inventory_threshold_configuration_changed": {
        "location_id", "country", "product_id", "old_threshold", "new_threshold",
        "unit", "change_source",
    },
    "login_succeeded": {"auth_method", "client_type", "outcome"},
    "login_failed": {"failure_code", "auth_method", "client_type", "attempt_bucket"},
    "session_expired": {"session_age_seconds", "client_type", "route_group", "expiry_reason"},
    "permission_denied": {"action_name", "resource_type", "reason_code", "client_type"},
    "api_request_completed": {
        "route_template", "method", "status_code", "duration_ms",
        "response_size_bucket", "client_type",
    },
    "api_request_failed": {
        "route_template", "method", "status_code", "error_code", "dependency",
    },
    "database_operation_slow": {
        "operation_name", "duration_ms", "table_group", "result_count_bucket",
    },
    "frontend_action_failed": {"action_name", "route_group", "error_code", "client_type"},
    "frontend_route_viewed": {"route_group", "client_type", "language", "entry_source"},
    "frontend_flow_step_completed": {
        "flow_name", "step_name", "step_index", "client_type",
    },
    "frontend_flow_abandoned": {
        "flow_name", "last_step", "elapsed_seconds", "client_type",
    },
    "telemetry_event_dropped": {
        "reason_code", "event_type", "pipeline_stage", "dropped_count",
    },
    "telemetry_schema_validation_failed": {
        "event_type", "schema_version", "validation_code", "source",
    },
}


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

    allowed = EVENT_PROPERTY_ALLOWLIST.get(event_type)
    if allowed is None or set(properties) - allowed:
        raise ValueError(f"Invalid telemetry properties for event type: {event_type}")

    event = {
        "event_id": str(event_id or uuid4()),
        "session_id": session_id or f"backend-{uuid4()}",
        "user_id": user_id,
        "event_timestamp": timestamp or datetime.now(timezone.utc),
        "event_type": event_type,
        "schema_version": "1.0.0",
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
            event = TelemetryEvent.model_validate(raw_event)
            allowed = EVENT_PROPERTY_ALLOWLIST[event.event_type]
            if set(event.properties) - allowed:
                rejected += 1
                continue
            valid_events.append(event)
        except (ValidationError, KeyError):
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
                            "session_id": event.sessionId or f"backend-{uuid4()}",
                            "user_id": event.userId,
                            "event_timestamp": event.timestamp,
                            "event_type": event.event_type,
                            "schema_version": event.schemaVersion,
                            "request_id": event.requestId or str(uuid4()),
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
                "event_type": "unknown_or_invalid",
                "schema_version": "1.0.0",
                "validation_code": "event_schema_invalid",
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
