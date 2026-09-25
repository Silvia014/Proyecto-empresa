from datetime import datetime, timezone
from typing import Optional

from .database import db


def create_supplier(supplier_data: dict) -> dict:
    supplier_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    doc_id = db.insert(supplier_data)

    return {
        "id": doc_id,
        **supplier_data,
    }


def get_suppliers(
    country: Optional[str] = None,
    category: Optional[str] = None,
) -> list[dict]:

    suppliers = db.all()

    if country:
        suppliers = [
            supplier
            for supplier in suppliers
            if supplier["country"].lower() == country.lower()
        ]

    if category:
        suppliers = [
            supplier
            for supplier in suppliers
            if category.lower() in [
                item.lower() for item in supplier["categories"]
            ]
        ]

    return [
        {
            "id": supplier.doc_id,
            **supplier,
        }
        for supplier in suppliers
    ]


def get_supplier(supplier_id: int) -> Optional[dict]:
    supplier = db.get(doc_id=supplier_id)

    if supplier is None:
        return None

    return {
        "id": supplier.doc_id,
        **supplier,
    }


def update_supplier_rate(
    supplier_id: int,
    rate_per_unit: float,
) -> Optional[dict]:

    supplier = db.get(doc_id=supplier_id)

    if supplier is None:
        return None

    updated_at = datetime.now(timezone.utc).isoformat()

    db.update(
        {
            "rate_per_unit": rate_per_unit,
            "updated_at": updated_at,
        },
        doc_ids=[supplier_id],
    )

    return get_supplier(supplier_id)


def update_supplier_status(
    supplier_id: int,
    status: str,
) -> Optional[dict]:

    supplier = db.get(doc_id=supplier_id)

    if supplier is None:
        return None

    db.update(
        {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        doc_ids=[supplier_id],
    )

    return get_supplier(supplier_id)


def delete_supplier(supplier_id: int) -> bool:
    supplier = db.get(doc_id=supplier_id)

    if supplier is None:
        return False

    db.remove(doc_ids=[supplier_id])
    return True
