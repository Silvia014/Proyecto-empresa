from functools import lru_cache
from time import monotonic

from sqlmodel import Session, select

from .models import InventoryItem, InventoryMovement


CACHE_TTL_SECONDS = 30
_stock_cache: dict[int, tuple[float, float]] = {}


def invalidate_stock_cache() -> None:
    _stock_cache.clear()


def calculate_stock(session: Session, item_id: int) -> float:
    now = monotonic()
    cached = _stock_cache.get(item_id)

    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    movements = session.exec(
        select(InventoryMovement).where(
            InventoryMovement.item_id == item_id
        )
    ).all()

    stock = sum(
        movement.quantity
        if movement.movement_type in ("inbound", "adjustment")
        else -movement.quantity
        for movement in movements
        if movement.movement_type in ("inbound", "outbound", "adjustment")
    )

    _stock_cache[item_id] = (now, stock)
    return stock


def calculate_stocks(
    session: Session,
    items: list[InventoryItem],
) -> dict[int, float]:
    item_ids = [item.id for item in items if item.id is not None]
    if not item_ids:
        return {}

    now = monotonic()
    stocks: dict[int, float] = {}
    missing_ids: list[int] = []

    for item_id in item_ids:
        cached = _stock_cache.get(item_id)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            stocks[item_id] = cached[1]
        else:
            missing_ids.append(item_id)

    if missing_ids:
        movements = session.exec(
            select(InventoryMovement).where(
                InventoryMovement.item_id.in_(missing_ids)
            )
        ).all()

        calculated = {item_id: 0.0 for item_id in missing_ids}

        for movement in movements:
            if movement.movement_type in ("inbound", "adjustment"):
                calculated[movement.item_id] += movement.quantity
            elif movement.movement_type == "outbound":
                calculated[movement.item_id] -= movement.quantity

        for item_id, stock in calculated.items():
            _stock_cache[item_id] = (now, stock)
            stocks[item_id] = stock

    return stocks
