from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..auth.dependencies import get_current_user
from ..database import get_db

from .models import InventoryItem, InventoryMovement
from .schemas import ProductCreate
from .services import calculate_stock, calculate_stocks


router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
)


# ---------------------------------------------------------
# PRODUCTS
# ---------------------------------------------------------

@router.get("/products")
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
            "below_reorder": stocks.get(item.id, 0)
            <= item.reorder_point,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        for item in items
    ]


@router.post(
    "/products",
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


@router.get("/products/{item_id}")
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

@router.post("/orders/inbound")
def create_inbound(
    movement: dict,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item_id = movement.get("item_id")
    quantity = movement.get("quantity")

    if not isinstance(quantity, (int, float)) or quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than zero.",
        )

    item = session.get(InventoryItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    record = InventoryMovement(
        item_id=item_id,
        lot_id=movement.get("lot_id"),
        movement_type="inbound",
        quantity=quantity,
        reason=movement.get("reason"),
        user_uuid=str(current_user["id"]),
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return record


# ---------------------------------------------------------
# OUTBOUND
# ---------------------------------------------------------

@router.post("/orders/outbound")
def create_outbound(
    movement: dict,
    session: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item_id = movement.get("item_id")
    quantity = movement.get("quantity")

    if not isinstance(quantity, (int, float)) or quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than zero.",
        )

    item = session.get(InventoryItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    current_stock = calculate_stock(session, item_id)

    if quantity > current_stock:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient stock. Available: "
                f"{current_stock}, requested: {quantity}."
            ),
        )

    record = InventoryMovement(
        item_id=item_id,
        lot_id=movement.get("lot_id"),
        movement_type="outbound",
        quantity=quantity,
        reason=movement.get("reason"),
        user_uuid=str(current_user["id"]),
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return record


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