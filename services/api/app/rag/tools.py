"""Read-only adapters for live operational services used by the RAG agent."""

from __future__ import annotations

import json
import os
import socket
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import datetime
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field, ValidationError


IncidentStatus = Literal["open", "in_progress", "resolved", "discarded"]
IncidentOrigin = Literal["customer", "branch", "internal"]
IncidentCategory = Literal[
    "equipment_failure",
    "supply_issue",
    "customer_complaint",
    "staff_issue",
    "facility_issue",
    "pos_system",
    "delivery_issue",
    "other",
]


class IncidentLookupInput(BaseModel):
    """Supported filters mirror the existing incidents API read endpoints."""

    ticket_id: int | None = Field(default=None, gt=0)
    status: IncidentStatus | None = None
    origin: IncidentOrigin | None = None
    category: IncidentCategory | None = None
    branch: str | None = Field(default=None, min_length=1, max_length=80)


class IncidentRecord(BaseModel):
    id: int
    title: str
    description: str
    status: IncidentStatus
    category: IncidentCategory
    origin: IncidentOrigin
    branch: str
    created_at: datetime
    updated_at: datetime


class IncidentLookupResult(BaseModel):
    status: Literal[
        "success", "not_found", "needs_filter", "timeout", "unavailable", "invalid_response"
    ]
    incidents: list[IncidentRecord] = Field(default_factory=list)
    truncated: bool = False
    message: str | None = None


class InventoryLookupInput(BaseModel):
    """Require a product search term so the tool cannot dump the full catalogue."""

    product_name: str | None = Field(default=None, min_length=2, max_length=120)
    location_id: str | None = Field(default=None, min_length=1, max_length=80)


class InventoryStockRecord(BaseModel):
    id: int
    location_id: str
    name: str
    category: str
    unit_of_measure: str
    current_stock: float
    reorder_point: float
    below_reorder: bool


class InventoryLookupResult(BaseModel):
    status: Literal["success", "not_found", "needs_filter", "forbidden", "timeout", "unavailable"]
    products: list[InventoryStockRecord] = Field(default_factory=list)
    truncated: bool = False


INVENTORY_TIMEOUT_SECONDS = 4.0
INVENTORY_RESULT_LIMIT = 25
_inventory_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="rag-inventory")


INCIDENTS_TIMEOUT_SECONDS = 4.0
INCIDENTS_RESULT_LIMIT = 25


def lookup_incidents(
    request: IncidentLookupInput,
    *,
    timeout: float = INCIDENTS_TIMEOUT_SECONDS,
) -> IncidentLookupResult:
    """Read live incidents over the existing GET API; never create or update data."""
    if request.ticket_id is None and not any(
        (request.status, request.origin, request.category, request.branch)
    ):
        return IncidentLookupResult(
            status="needs_filter",
            message="Ask for a ticket ID or a specific incident filter.",
        )

    api_base = os.getenv("INCIDENTS_API_URL", "http://127.0.0.1:8000").rstrip("/")
    if request.ticket_id is not None:
        url = f"{api_base}/api/incidents/{request.ticket_id}"
    else:
        filters = request.model_dump(exclude_none=True)
        filters.pop("ticket_id", None)
        url = f"{api_base}/api/incidents?{urlencode(filters)}"

    http_request = Request(url, headers={"Accept": "application/json"}, method="GET")
    try:
        with urlopen(http_request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404 and request.ticket_id is not None:
            return IncidentLookupResult(status="not_found")
        return IncidentLookupResult(status="unavailable")
    except (TimeoutError, socket.timeout):
        return IncidentLookupResult(status="timeout")
    except URLError as exc:
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            return IncidentLookupResult(status="timeout")
        return IncidentLookupResult(status="unavailable")
    except OSError:
        return IncidentLookupResult(status="unavailable")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return IncidentLookupResult(status="invalid_response")

    try:
        if request.ticket_id is not None:
            incidents = [IncidentRecord.model_validate(payload)]
        else:
            if not isinstance(payload, list):
                raise ValueError("Expected a list of incidents.")
            incidents = [IncidentRecord.model_validate(item) for item in payload]
    except (ValidationError, ValueError, TypeError):
        return IncidentLookupResult(status="invalid_response")

    return IncidentLookupResult(
        status="success" if incidents else "not_found",
        incidents=incidents[:INCIDENTS_RESULT_LIMIT],
        truncated=len(incidents) > INCIDENTS_RESULT_LIMIT,
    )


def _read_inventory_products(
    request: InventoryLookupInput,
) -> tuple[list[InventoryStockRecord], bool]:
    """Reuse the inventory models and stock calculation used by its GET route."""
    from sqlalchemy import text
    from sqlmodel import Session, select

    from ..database import engine
    from ..inventory.models import InventoryItem
    from ..inventory.services import calculate_stocks

    statement = select(InventoryItem).order_by(InventoryItem.name)
    if request.product_name:
        escaped_name = request.product_name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(InventoryItem.name.ilike(f"%{escaped_name}%"))
    if request.location_id:
        statement = statement.where(InventoryItem.location_id == request.location_id)

    with Session(engine) as session:
        with session.begin():
            # PostgreSQL cancels a slow statement at the same deadline as the tool.
            if engine.dialect.name == "postgresql":
                session.exec(text("SET LOCAL statement_timeout = '4000ms'"))
            items = session.exec(statement.limit(INVENTORY_RESULT_LIMIT + 1)).all()
            stocks = calculate_stocks(
                session,
                items[:INVENTORY_RESULT_LIMIT],
                force_refresh=True,
            )
            products = [
                InventoryStockRecord(
                    id=item.id,
                    location_id=item.location_id,
                    name=item.name,
                    category=item.category,
                    unit_of_measure=item.unit_of_measure,
                    current_stock=stocks.get(item.id, 0),
                    reorder_point=item.reorder_point,
                    below_reorder=stocks.get(item.id, 0) <= item.reorder_point,
                )
                for item in items[:INVENTORY_RESULT_LIMIT]
            ]
            return products, len(items) > INVENTORY_RESULT_LIMIT


def lookup_inventory(
    request: InventoryLookupInput,
    *,
    actor_role: str | None,
    timeout: float = INVENTORY_TIMEOUT_SECONDS,
) -> InventoryLookupResult:
    """Read live stock through the existing inventory service layer."""
    from ..auth.supabase_dependencies import ROLE_PERMISSIONS

    if "inventory" not in ROLE_PERMISSIONS.get(actor_role or "", set()):
        return InventoryLookupResult(status="forbidden")
    if not request.product_name and not request.location_id:
        return InventoryLookupResult(status="needs_filter")

    future = _inventory_executor.submit(_read_inventory_products, request)
    try:
        products, truncated = future.result(timeout=timeout)
    except FutureTimeoutError:
        future.cancel()
        return InventoryLookupResult(status="timeout")
    except Exception:
        return InventoryLookupResult(status="unavailable")

    return InventoryLookupResult(
        status="success" if products else "not_found",
        products=products,
        truncated=truncated,
    )
