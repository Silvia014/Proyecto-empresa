from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


VALID_CATEGORIES = {
    "meat",
    "produce",
    "sauces_condiments",
    "beverages",
    "packaging",
    "cleaning_supplies",
}

VALID_UNITS = {
    "kg",
    "g",
    "l",
    "ml",
    "unit",
}

VALID_MOVEMENT_TYPES = {
    "inbound",
    "outbound",
    "adjustment",
}


class ProductCreate(BaseModel):
    location_id: str
    name: str
    category: str
    unit_of_measure: str
    reorder_point: float = Field(ge=0)


class ProductResponse(BaseModel):
    id: int
    location_id: str
    name: str
    category: str
    unit_of_measure: str
    reorder_point: float
    current_stock: float
    below_reorder: bool
    created_at: datetime
    updated_at: datetime


class MovementCreate(BaseModel):
    item_id: int
    lot_id: Optional[int] = None
    quantity: float = Field(gt=0)
    reason: Optional[str] = None

class AdjustmentCreate(BaseModel):
    item_id: int
    lot_id: Optional[int] = None
    quantity: float
    reason: str = Field(min_length=1)

class MovementResponse(BaseModel):
    id: int
    item_id: int
    lot_id: Optional[int]
    movement_type: str
    quantity: float
    reason: Optional[str]
    created_at: datetime
    user_uuid: str


class LotCreate(BaseModel):
    item_id: int
    lot_code: str
    expiry_date: Optional[datetime] = None