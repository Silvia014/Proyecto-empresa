from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from .models import (
    InventoryItem,
    InventoryLot,
    InventoryMovement,
    Location,
)


LOCATIONS = [
    {
        "id": "CO-BOG-01",
        "name": "Brasaland Bogotá",
        "city": "Bogotá",
        "country": "Colombia",
        "currency": "COP",
    },
    {
        "id": "CO-MDE-01",
        "name": "Brasaland Medellín",
        "city": "Medellín",
        "country": "Colombia",
        "currency": "COP",
    },
    {
        "id": "US-MIA-01",
        "name": "Brasaland Miami",
        "city": "Miami",
        "country": "USA",
        "currency": "USD",
    },
    {
        "id": "US-ORL-01",
        "name": "Brasaland Orlando",
        "city": "Orlando",
        "country": "USA",
        "currency": "USD",
    },
]


PRODUCTS = [
    ("CO-BOG-01", "Beef Ribs", "meat", "kg", 20),
    ("CO-BOG-01", "Chicken Wings", "meat", "kg", 15),
    ("CO-BOG-01", "Tomatoes", "produce", "kg", 10),
    ("CO-BOG-01", "Onions", "produce", "kg", 8),

    ("CO-MDE-01", "BBQ Sauce", "sauces_condiments", "l", 5),
    ("CO-MDE-01", "Mustard", "sauces_condiments", "l", 4),
    ("CO-MDE-01", "Cola", "beverages", "l", 20),
    ("CO-MDE-01", "Water", "beverages", "l", 15),

    ("US-MIA-01", "Burger Boxes", "packaging", "unit", 50),
    ("US-MIA-01", "Paper Cups", "packaging", "unit", 40),
    ("US-MIA-01", "Beef Brisket", "meat", "kg", 12),
    ("US-MIA-01", "Lettuce", "produce", "kg", 8),

    ("US-ORL-01", "Dish Soap", "cleaning_supplies", "l", 5),
    ("US-ORL-01", "Sanitizer", "cleaning_supplies", "l", 5),
    ("US-ORL-01", "Napkins", "packaging", "unit", 100),
]


def seed_inventory(session: Session) -> None:
    # ---------------------------------------------------------
    # LOCATIONS
    # ---------------------------------------------------------

    for data in LOCATIONS:
        location = session.get(Location, data["id"])

        if location is None:
            session.add(Location(**data))

    session.commit()

    # ---------------------------------------------------------
    # PRODUCTS
    # ---------------------------------------------------------

    now = datetime.now(timezone.utc)

    for location_id, name, category, unit, reorder_point in PRODUCTS:

        existing = session.exec(
            select(InventoryItem).where(
                InventoryItem.location_id == location_id,
                InventoryItem.name == name,
            )
        ).first()

        if existing is not None:
            continue

        item = InventoryItem(
            location_id=location_id,
            name=name,
            category=category,
            unit_of_measure=unit,
            reorder_point=reorder_point,
            created_at=now,
            updated_at=now,
        )

        session.add(item)
        session.commit()
        session.refresh(item)

        # -----------------------------------------------------
        # LOTS
        # -----------------------------------------------------

        lot_id = None

        if category in {"meat", "produce"}:
            expiry = now + timedelta(days=30)

            # One deliberately expired lot
            if name == "Beef Brisket":
                expiry = now - timedelta(days=5)

            lot = InventoryLot(
                item_id=item.id,
                lot_code=f"LOT-{item.id:03d}",
                expiry_date=expiry,
                received_at=now,
            )

            session.add(lot)
            session.commit()
            session.refresh(lot)

            lot_id = lot.id

        # -----------------------------------------------------
        # INBOUND
        # -----------------------------------------------------

        inbound_quantity = reorder_point * 2

        inbound = InventoryMovement(
            item_id=item.id,
            lot_id=lot_id,
            movement_type="inbound",
            quantity=inbound_quantity,
            reason="Initial stock",
            user_uuid="seed",
        )

        session.add(inbound)

        # -----------------------------------------------------
        # OUTBOUND
        # -----------------------------------------------------

        outbound_quantity = reorder_point * 0.5

        outbound = InventoryMovement(
            item_id=item.id,
            lot_id=lot_id,
            movement_type="outbound",
            quantity=outbound_quantity,
            reason="Sales",
            user_uuid="seed",
        )

        session.add(outbound)

        session.commit()

        # -----------------------------------------------------
        # ADJUSTMENTS
        # -----------------------------------------------------

        adjustment_quantity = 0

        if name == "Tomatoes":
            adjustment_quantity = -5

        elif name == "Burger Boxes":
            adjustment_quantity = -25

        elif name == "Lettuce":
            adjustment_quantity = -4

        if adjustment_quantity != 0:
            reason = (
                "waste"
                if adjustment_quantity < 0
                else "stock count correction"
            )

            adjustment = InventoryMovement(
                item_id=item.id,
                lot_id=lot_id,
                movement_type="adjustment",
                quantity=adjustment_quantity,
                reason=reason,
                user_uuid="seed",
            )

            session.add(adjustment)
            session.commit()