from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


VALID_CATEGORIES = [
    "carne",
    "verduras_y_hortalizas",
    "salsas_y_condimentos",
    "bebidas",
    "packaging",
    "productos_limpieza",
    "lacteos",
    "carbon_y_combustible",
]


class SupplierStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class SupplierBase(BaseModel):
    name: str
    country: str
    categories: List[str] = Field(min_length=1)
    rate_per_unit: float = Field(gt=0)
    currency: str
    status: SupplierStatus
    contact_email: Optional[EmailStr] = None
    notes: Optional[str] = None

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        if value not in {"Colombia", "USA"}:
            raise ValueError("country must be Colombia or USA")
        return value

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: List[str]) -> List[str]:
        invalid = [category for category in value if category not in VALID_CATEGORIES]

        if invalid:
            raise ValueError(
                f"Invalid categories: {', '.join(invalid)}"
            )

        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        if value not in {"COP", "USD"}:
            raise ValueError("currency must be COP or USD")

        return value


class SupplierCreate(SupplierBase):
    @field_validator("currency")
    @classmethod
    def validate_currency_for_country(cls, value: str, info):
        country = info.data.get("country")

        if country == "Colombia" and value != "COP":
            raise ValueError("Colombia suppliers must use COP")

        if country == "USA" and value != "USD":
            raise ValueError("USA suppliers must use USD")

        return value


class Supplier(SupplierBase):
    id: int
    updated_at: datetime
