from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class IncidentStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class IncidentOrigin(str, Enum):
    CUSTOMER = "customer"
    BRANCH = "branch"
    INTERNAL = "internal"


class IncidentCategory(str, Enum):
    EQUIPMENT_FAILURE = "equipment_failure"
    SUPPLY_ISSUE = "supply_issue"
    CUSTOMER_COMPLAINT = "customer_complaint"
    STAFF_ISSUE = "staff_issue"
    FACILITY_ISSUE = "facility_issue"
    POS_SYSTEM = "pos_system"
    DELIVERY_ISSUE = "delivery_issue"
    OTHER = "other"


VALID_BRANCHES = {
    "central",
    "medellin_centro",
    "medellin_laureles",
    "medellin_envigado",
    "medellin_bello",
    "medellin_itagui",
    "bogota_chapinero",
    "bogota_usaquen",
    "cali_granada",
    "barranquilla_norte",
    "miami_doral",
    "miami_hialeah",
    "miami_kendall",
    "orlando_international",
    "fort_lauderdale",
}


class IncidentBase(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    category: IncidentCategory
    status: IncidentStatus = IncidentStatus.OPEN
    origin: IncidentOrigin
    branch: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    @field_validator("branch")
    @classmethod
    def validate_branch(cls, value: str) -> str:
        if value not in VALID_BRANCHES:
            raise ValueError(f"Invalid branch: {value}")
        return value


class IncidentCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    category: IncidentCategory
    origin: IncidentOrigin
    branch: str
    @field_validator("branch")
    @classmethod
    def validate_branch(cls, value: str) -> str:
        if value not in VALID_BRANCHES:
            raise ValueError(f"Invalid branch: {value}")
        return value


class Incident(IncidentBase):
    id: int
