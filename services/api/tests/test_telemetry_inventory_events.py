from sqlmodel import Session, SQLModel, create_engine
from fastapi import HTTPException

from app.inventory import routes as inventory_routes
from app.inventory.models import InventoryItem, InventoryMovement, Location
from app.inventory.schemas import AdjustmentCreate, MovementCreate
from app.inventory.services import invalidate_stock_cache
from app import telemetry


def make_session():
    invalidate_stock_cache()
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def make_item(session):
    location = Location(
        id="TEST-01",
        name="Test location",
        city="Test city",
        country="Colombia",
        currency="COP",
    )
    item = InventoryItem(
        location_id="TEST-01",
        name="Test ingredient",
        category="packaging",
        unit_of_measure="kg",
        reorder_point=5,
    )
    session.add(location)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def seed_movement(session, item, movement_type, quantity, **kwargs):
    record = InventoryMovement(
        item_id=item.id,
        movement_type=movement_type,
        quantity=quantity,
        user_uuid="test-user",
        **kwargs,
    )
    session.add(record)
    session.commit()
    return record


def test_inbound_emits_order_and_product_price_variance(monkeypatch):
    session = make_session()
    item = make_item(session)
    seed_movement(
        session, item, "inbound", 2, supplier_id=7, unit_cost=10.0
    )
    events = []
    monkeypatch.setattr(
        inventory_routes,
        "record_internal_event",
        lambda event_type, user_id, properties, **kwargs: events.append(
            (event_type, properties)
        ),
    )

    result = inventory_routes.create_inbound(
        MovementCreate(
            item_id=item.id,
            quantity=3,
            supplier_id=7,
            unit_cost=12.0,
        ),
        session=session,
        current_user={"id": "test-user"},
    )

    assert result["movement_type"] == "inbound"
    by_type = {event_type: properties for event_type, properties in events}
    assert by_type["inbound_order_created"]["product_id"] == item.id
    assert by_type["inbound_order_created"]["supplier_id"] == 7
    assert by_type["inbound_order_created"]["total_cost"] == 36.0
    assert by_type["ingredient_price_variance_detected"]["reference_unit_cost"] == 10.0
    assert by_type["ingredient_price_variance_detected"]["current_unit_cost"] == 12.0
    assert by_type["ingredient_price_variance_detected"]["variance_percent"] == 20.0
    assert by_type["ingredient_price_variance_detected"]["country"] == "CO"


def test_outbound_emits_order_waste_and_stock_threshold(monkeypatch):
    session = make_session()
    item = make_item(session)
    seed_movement(session, item, "inbound", 10)
    events = []
    monkeypatch.setattr(
        inventory_routes,
        "record_internal_event",
        lambda event_type, user_id, properties, **kwargs: events.append(
            (event_type, properties)
        ),
    )

    inventory_routes.create_outbound(
        MovementCreate(item_id=item.id, quantity=6, reason="expired"),
        session=session,
        current_user={"id": "test-user"},
    )

    by_type = {event_type: properties for event_type, properties in events}
    assert {"outbound_order_created", "stock_waste_registered", "stock_threshold_triggered"} <= set(by_type)
    assert by_type["outbound_order_created"]["reason"] == "expired"
    assert by_type["stock_waste_registered"]["order_id"] is None
    assert by_type["stock_waste_registered"]["reason"] == "expired"
    assert by_type["stock_threshold_triggered"]["quantity"] == 4
    assert by_type["stock_threshold_triggered"]["country"] == "CO"


def test_rejected_direct_stock_edit_emits_audit_event(monkeypatch):
    session = make_session()
    item = make_item(session)
    seed_movement(session, item, "inbound", 5)
    events = []
    monkeypatch.setattr(
        inventory_routes,
        "record_internal_event",
        lambda event_type, user_id, properties, **kwargs: events.append(
            (event_type, properties)
        ),
    )

    try:
        inventory_routes.create_adjustment(
            AdjustmentCreate(
                item_id=item.id,
                quantity=-6,
                reason="invalid direct edit",
            ),
            session=session,
            current_user={"id": "test-user"},
        )
        assert False, "Expected rejected negative-stock adjustment"
    except HTTPException as exc:
        assert exc.status_code == 400

    assert len(events) == 1
    event_type, properties = events[0]
    assert event_type == "direct_stock_edit_rejected"
    assert properties["product_id"] == item.id
    assert properties["rejection_code"] == "adjustment_would_make_stock_negative"
    assert properties["source"] == "inventory_adjustment"



def test_telemetry_batch_stores_valid_events_and_counts_rejections(monkeypatch):
    class FakeResult:
        rowcount = 1

    class FakeSession:
        def __init__(self, engine):
            self.executed = []

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, statement, params):
            self.executed.append(params)
            return FakeResult()

        def commit(self):
            pass

    recorded = []
    monkeypatch.setattr(telemetry, "Session", FakeSession)
    monkeypatch.setattr(
        telemetry,
        "record_internal_event",
        lambda event_type, user_id, properties, **kwargs: recorded.append(
            (event_type, properties)
        ),
    )

    response = telemetry.receive_telemetry(
        {
            "events": [
                {
                    "eventId": "e78b31b0-2e9d-4b7b-9e0f-4e9d08b3f6d1",
                    "sessionId": "test-session",
                    "timestamp": "2026-10-28T07:00:00Z",
                    "event_type": "outbound_order_created",
                    "schemaVersion": "1.0",
                    "requestId": "test-request",
                    "properties": {"product_id": 12},
                },
                {"event_type": "not_a_real_event"},
            ]
        }
    )

    assert response == {"received": 2, "stored": 1, "rejected": 1}
    assert recorded[0][0] == "telemetry_schema_validation_failed"
    assert recorded[0][1]["rejected_count"] == 1
