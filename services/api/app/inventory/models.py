from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class Location(SQLModel, table=True):
    __tablename__ = "Location"

    id: str = Field(primary_key=True)
    name: str
    city: str
    country: str
    currency: str

    items: list["InventoryItem"] = Relationship(back_populates="location")


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"

    id: Optional[int] = Field(default=None, primary_key=True)

    location_id: str = Field(
        foreign_key="Location.id",
        index=True,
    )

    name: str
    category: str
    unit_of_measure: str
    reorder_point: float

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    location: Optional[Location] = Relationship(
        back_populates="items"
    )

    lots: list["InventoryLot"] = Relationship(
        back_populates="item"
    )

    movements: list["InventoryMovement"] = Relationship(
        back_populates="item"
    )


class InventoryLot(SQLModel, table=True):
    __tablename__ = "inventory_lots"

    id: Optional[int] = Field(default=None, primary_key=True)

    item_id: int = Field(
        foreign_key="inventory_items.id",
        index=True,
    )

    lot_code: str
    expiry_date: Optional[datetime] = None

    received_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    item: Optional[InventoryItem] = Relationship(
        back_populates="lots"
    )

    movements: list["InventoryMovement"] = Relationship(
        back_populates="lot"
    )


class InventoryMovement(SQLModel, table=True):
    __tablename__ = "inventory_movements"

    id: Optional[int] = Field(default=None, primary_key=True)

    item_id: int = Field(
        foreign_key="inventory_items.id",
        index=True,
    )

    lot_id: Optional[int] = Field(
        default=None,
        foreign_key="inventory_lots.id",
        index=True,
    )

    movement_type: str

    quantity: float

    reason: Optional[str] = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    user_uuid: str

    item: Optional[InventoryItem] = Relationship(
        back_populates="movements"
    )

    lot: Optional[InventoryLot] = Relationship(
        back_populates="movements"
    )