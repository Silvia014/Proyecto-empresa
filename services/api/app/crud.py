from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlmodel import Session, select

from .database import engine
from .supplier_directory_model import SupplierDirectoryRecord


def _to_dict(supplier: SupplierDirectoryRecord) -> dict:
    return {
        "id": supplier.id,
        "name": supplier.name,
        "country": supplier.country,
        "categories": supplier.categories,
        "rate_per_unit": supplier.rate_per_unit,
        "currency": supplier.currency,
        "status": supplier.status,
        "contact_email": supplier.contact_email,
        "notes": supplier.notes,
        "updated_at": supplier.updated_at,
    }


def create_supplier(supplier_data: dict) -> dict:
    data = dict(supplier_data)
    data["updated_at"] = datetime.now(timezone.utc)

    with Session(engine) as session:
        supplier = SupplierDirectoryRecord(**data)
        session.add(supplier)
        session.commit()
        session.refresh(supplier)
        return _to_dict(supplier)


def get_suppliers(
    country: Optional[str] = None,
    category: Optional[str] = None,
) -> list[dict]:
    with Session(engine) as session:
        statement = select(SupplierDirectoryRecord)

        if country:
            statement = statement.where(
                func.lower(SupplierDirectoryRecord.country)
                == country.lower()
            )
            
        suppliers = session.exec(statement).all()

        results = []
        for supplier in suppliers:
            item = _to_dict(supplier)
            if category and category.lower() not in [
                value.lower() for value in item["categories"]
            ]:
                continue
            results.append(item)

        return results


def get_supplier(supplier_id: int) -> Optional[dict]:
    with Session(engine) as session:
        supplier = session.get(SupplierDirectoryRecord, supplier_id)
        return _to_dict(supplier) if supplier else None


def update_supplier_rate(
    supplier_id: int,
    rate_per_unit: float,
) -> Optional[dict]:
    """Update a supplier's directory-level indicative rate.

    This is not a product-specific price observation, so it must not emit
    ingredient_price_variance_detected. That event is emitted from inbound
    inventory receipts when the same product/supplier has a comparable cost.
    """
    with Session(engine) as session:
        supplier = session.get(SupplierDirectoryRecord, supplier_id)

        if supplier is None:
            return None

        supplier.rate_per_unit = rate_per_unit
        supplier.updated_at = datetime.now(timezone.utc)
        session.add(supplier)
        session.commit()
        session.refresh(supplier)
        return _to_dict(supplier)


def update_supplier_status(
    supplier_id: int,
    status: str,
) -> Optional[dict]:
    with Session(engine) as session:
        supplier = session.get(SupplierDirectoryRecord, supplier_id)

        if supplier is None:
            return None

        supplier.status = status
        supplier.updated_at = datetime.now(timezone.utc)
        session.add(supplier)
        session.commit()
        session.refresh(supplier)
        return _to_dict(supplier)


def delete_supplier(supplier_id: int) -> bool:
    with Session(engine) as session:
        supplier = session.get(SupplierDirectoryRecord, supplier_id)

        if supplier is None:
            return False

        session.delete(supplier)
        session.commit()
        return True
