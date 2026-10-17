
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, Text
from sqlmodel import Field, SQLModel


class SupplierDirectoryRecord(SQLModel, table=True):
    """PostgreSQL record for the legacy supplier directory."""

    __tablename__ = "supplier_directory"

    # Preserve source document IDs during the data migration.
    id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, primary_key=True, autoincrement=True),
    )

    name: str = Field(sa_column=Column(String, nullable=False))
    country: str = Field(sa_column=Column(String, nullable=False))
    categories: List[str] = Field(
        sa_column=Column(JSON, nullable=False)
    )
    rate_per_unit: float = Field(
        sa_column=Column(Float, nullable=False)
    )
    currency: str = Field(sa_column=Column(String, nullable=False))
    status: str = Field(sa_column=Column(String, nullable=False))
    contact_email: Optional[str] = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    notes: Optional[str] = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
        ),
    )
