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
    import os

    with Session(engine) as session:
        supplier = session.get(SupplierDirectoryRecord, supplier_id)

        if supplier is None:
            return None

        previous_rate = supplier.rate_per_unit
        rate_change_percent = (
            abs(rate_per_unit - previous_rate) / previous_rate * 100
            if previous_rate > 0
            else 0
        )

        supplier.rate_per_unit = rate_per_unit
        supplier.updated_at = datetime.now(timezone.utc)
        session.add(supplier)
        session.commit()
        session.refresh(supplier)

        result = _to_dict(supplier)

        if rate_change_percent >= threshold_percent:
            record_internal_event(
                "ingredient_price_variance_detected",
                None,
                {
                    "supplier_id": supplier.id,
                    "supplier_name": supplier.name,
                    "country": supplier.country,
                    "product_category": supplier.categories,
                    "previous_rate": previous_rate,
                    "new_rate": rate_per_unit,
                    "rate_change_percent": round(rate_change_percent, 2),
                    "currency": supplier.currency,
                    "unit": "supplier_rate_unit",
                },
            )

        return result


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
