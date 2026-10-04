from sqlmodel import Session, SQLModel, create_engine
from fastapi import HTTPException

from app.inventory.models import (
    InventoryItem,
    InventoryMovement,
    Location,
)
from app.inventory.routes import create_outbound
from app.inventory.schemas import MovementCreate
from app.inventory.services import calculate_stock


def create_test_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
    )

    SQLModel.metadata.create_all(engine)

    return Session(engine)


def create_test_item(session: Session) -> InventoryItem:
    location = Location(
        id="TEST-01",
        name="Test Location",
        city="Test City",
        country="Test Country",
        currency="USD",
    )

    item = InventoryItem(
        location_id="TEST-01",
        name="Test Cups",
        category="packaging",
        unit_of_measure="unit",
        reorder_point=5,
    )

    session.add(location)
    session.add(item)
    session.commit()
    session.refresh(item)

    return item


def test_calculate_stock():
    session = create_test_session()
    item = create_test_item(session)

    session.add(
        InventoryMovement(
            item_id=item.id,
            movement_type="inbound",
            quantity=10,
            reason="Initial stock",
            user_uuid="test-user",
        )
    )

    session.add(
        InventoryMovement(
            item_id=item.id,
            movement_type="outbound",
            quantity=3,
            reason="Sale",
            user_uuid="test-user",
        )
    )

    session.add(
        InventoryMovement(
            item_id=item.id,
            movement_type="adjustment",
            quantity=-1,
            reason="waste",
            user_uuid="test-user",
        )
    )

    session.commit()

    assert calculate_stock(session, item.id) == 6


def test_outbound_cannot_create_negative_stock():
    session = create_test_session()
    item = create_test_item(session)

    session.add(
        InventoryMovement(
            item_id=item.id,
            movement_type="inbound",
            quantity=5,
            reason="Initial stock",
            user_uuid="test-user",
        )
    )

    session.commit()

    movement = MovementCreate(
        item_id=item.id,
        quantity=10,
        lot_id=None,
        reason="Sale",
    )

    try:
        create_outbound(
            movement=movement,
            session=session,
            current_user={"id": "test-user"},
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Insufficient stock" in exc.detail


def test_stock_stays_unchanged_after_rejected_outbound():
    session = create_test_session()
    item = create_test_item(session)

    session.add(
        InventoryMovement(
            item_id=item.id,
            movement_type="inbound",
            quantity=5,
            reason="Initial stock",
            user_uuid="test-user",
        )
    )

    session.commit()

    movement = MovementCreate(
        item_id=item.id,
        quantity=10,
        lot_id=None,
        reason="Sale",
    )

    try:
        create_outbound(
            movement=movement,
            session=session,
            current_user={"id": "test-user"},
        )
    except HTTPException:
        pass

    assert calculate_stock(session, item.id) == 5