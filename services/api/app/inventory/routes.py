from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..auth.dependencies import get_current_user
from ..database import get_db

from .models import InventoryItem, InventoryMovement, InventoryLot
from .schemas import (
    ProductCreate,
    ProductResponse,
    MovementCreate,
    MovementResponse,
    AdjustmentCreate,
)
from .services import calculate_stock, calculate_stocks


router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
)


# ---------------------------------------------------------
# PRODUCTS
# ---------------------------------------------------------

@router.get("/products", response_model=list[ProductResponse])
def list_products(
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = session.exec(
        select(InventoryItem)
        .order_by(InventoryItem.name)
    ).all()

    stocks = calculate_stocks(session, items)

    return [
        {
            "id": item.id,
            "location_id": item.location_id,
            "name": item.name,
            "category": item.category,
            "unit_of_measure": item.unit_of_measure,
            "reorder_point": item.reorder_point,
            "current_stock": stocks.get(item.id, 0),
            "below_reorder": stocks.get(item.id, 0) <= item.reorder_point,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        for item in items
    ]


@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product: ProductCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if product.category not in {
        "meat",
        "produce",
        "sauces_condiments",
        "beverages",
        "packaging",
        "cleaning_supplies",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid inventory category.",
        )

    if product.unit_of_measure not in {
        "kg",
        "g",
        "l",
        "ml",
        "unit",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid unit of measure.",
        )

    item = InventoryItem.model_validate(product)

    session.add(item)
    session.commit()
    session.refresh(item)

    return {
        "id": item.id,
        "location_id": item.location_id,
        "name": item.name,
        "category": item.category,
        "unit_of_measure": item.unit_of_measure,
        "reorder_point": item.reorder_point,
        "current_stock": 0,
        "below_reorder": True,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get("/products/{item_id}", response_model=ProductResponse)
def get_product(
    item_id: int,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = session.get(InventoryItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    stock = calculate_stock(session, item_id)

    return {
        "id": item.id,
        "location_id": item.location_id,
        "name": item.name,
        "category": item.category,
        "unit_of_measure": item.unit_of_measure,
        "reorder_point": item.reorder_point,
        "current_stock": stock,
        "below_reorder": stock <= item.reorder_point,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


# ---------------------------------------------------------
# INBOUND
# ---------------------------------------------------------

@router.post(
    "/orders/inbound",
    response_model=MovementResponse,
)
def create_inbound(
    movement: MovementCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = session.get(InventoryItem, movement.item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    # Meat and produce require a lot
    if item.category in {"meat", "produce"} and movement.lot_id is None:
        raise HTTPException(
            status_code=400,
            detail="A lot is required for meat and produce items.",
        )

    # Lot must exist and belong to this product
    if movement.lot_id is not None:
        lot = session.get(InventoryLot, movement.lot_id)

        if lot is None or lot.item_id != item.id:
            raise HTTPException(
                status_code=400,
                detail="The specified lot does not belong to this product.",
            )

    record = InventoryMovement(
        item_id=movement.item_id,
        lot_id=movement.lot_id,
        movement_type="inbound",
        quantity=movement.quantity,
        reason=movement.reason,
        user_uuid=str(current_user["id"]),
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "item_id": record.item_id,
        "lot_id": record.lot_id,
        "movement_type": record.movement_type,
        "quantity": record.quantity,
        "reason": record.reason,
        "created_at": record.created_at,
        "user_uuid": record.user_uuid,
    }


# ---------------------------------------------------------
# OUTBOUND
# ---------------------------------------------------------

@router.post(
    "/orders/outbound",
    response_model=MovementResponse,
)
def create_outbound(
    movement: MovementCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = session.get(InventoryItem, movement.item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    # Meat and produce require a lot
    if item.category in {"meat", "produce"} and movement.lot_id is None:
        raise HTTPException(
            status_code=400,
            detail="A lot is required for meat and produce items.",
        )

    # Lot must exist and belong to this product
    if movement.lot_id is not None:
        lot = session.get(InventoryLot, movement.lot_id)

        if lot is None or lot.item_id != item.id:
            raise HTTPException(
                status_code=400,
                detail="The specified lot does not belong to this product.",
            )

    current_stock = calculate_stock(session, movement.item_id)

    if movement.quantity > current_stock:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient stock. Available: "
                f"{current_stock}, requested: {movement.quantity}."
            ),
        )

    record = InventoryMovement(
        item_id=movement.item_id,
        lot_id=movement.lot_id,
        movement_type="outbound",
        quantity=movement.quantity,
        reason=movement.reason,
        user_uuid=str(current_user["id"]),
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "item_id": record.item_id,
        "lot_id": record.lot_id,
        "movement_type": record.movement_type,
        "quantity": record.quantity,
        "reason": record.reason,
        "created_at": record.created_at,
        "user_uuid": record.user_uuid,
    }


# ---------------------------------------------------------
# ADJUSTMENT
# ---------------------------------------------------------

@router.post(
    "/orders/adjustment",
    response_model=MovementResponse,
)
def create_adjustment(
    movement: AdjustmentCreate,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = session.get(InventoryItem, movement.item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    # Meat and produce require a lot
    if item.category in {"meat", "produce"} and movement.lot_id is None:
        raise HTTPException(
            status_code=400,
            detail="A lot is required for meat and produce items.",
        )

    # Lot must exist and belong to this product
    if movement.lot_id is not None:
        lot = session.get(InventoryLot, movement.lot_id)

        if lot is None or lot.item_id != item.id:
            raise HTTPException(
                status_code=400,
                detail="The specified lot does not belong to this product.",
            )

    current_stock = calculate_stock(session, movement.item_id)
    new_stock = current_stock + movement.quantity

    if new_stock < 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Adjustment would result in negative stock. "
                f"Available: {current_stock}, "
                f"adjustment: {movement.quantity}."
            ),
        )

    record = InventoryMovement(
        item_id=movement.item_id,
        lot_id=movement.lot_id,
        movement_type="adjustment",
        quantity=movement.quantity,
        reason=movement.reason,
        user_uuid=str(current_user["id"]),
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "item_id": record.item_id,
        "lot_id": record.lot_id,
        "movement_type": record.movement_type,
        "quantity": record.quantity,
        "reason": record.reason,
        "created_at": record.created_at,
        "user_uuid": record.user_uuid,
    }


# ---------------------------------------------------------
# ORDERS / MOVEMENTS
# ---------------------------------------------------------

@router.get("/orders")
def list_orders(
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    movements = session.exec(
        select(InventoryMovement, InventoryItem)
        .join(
            InventoryItem,
            InventoryMovement.item_id == InventoryItem.id,
        )
        .order_by(InventoryMovement.created_at.desc())
    ).all()

    return [
        {
            "id": movement.id,
            "item_id": movement.item_id,
            "product_name": item.name,
            "movement_type": movement.movement_type,
            "quantity": movement.quantity,
            "lot_id": movement.lot_id,
            "reason": movement.reason,
            "created_at": movement.created_at,
            "user_uuid": movement.user_uuid,
        }
        for movement, item in movements
    ]