from sqlmodel import Session, select

from .models import InventoryItem, InventoryMovement


def calculate_stock(
    session: Session,
    item_id: int,
) -> float:

    movements = session.exec(
        select(InventoryMovement)
        .where(InventoryMovement.item_id == item_id)
    ).all()

    stock = 0.0

    for movement in movements:

        if movement.movement_type == "inbound":
            stock += movement.quantity

        elif movement.movement_type == "outbound":
            stock -= movement.quantity

        elif movement.movement_type == "adjustment":
            stock += movement.quantity

    return stock


def calculate_stocks(
    session: Session,
    items: list[InventoryItem],
) -> dict[int, float]:

    item_ids = [item.id for item in items if item.id is not None]

    if not item_ids:
        return {}

    movements = session.exec(
        select(InventoryMovement)
        .where(InventoryMovement.item_id.in_(item_ids))
    ).all()

    stocks = {item_id: 0.0 for item_id in item_ids}

    for movement in movements:

        if movement.movement_type == "inbound":
            stocks[movement.item_id] += movement.quantity

        elif movement.movement_type == "outbound":
            stocks[movement.item_id] -= movement.quantity

        elif movement.movement_type == "adjustment":
            stocks[movement.item_id] += movement.quantity

    return stocks