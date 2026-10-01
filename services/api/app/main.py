from typing import Optional
import os
from pathlib import Path
from fastapi.responses import JSONResponse

env_file = Path(__file__).resolve().parents[3] / ".env.local"

if env_file.exists():
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
from .users.routes import router as users_router
from .profiles.routes import router as profiles_router
from .auth.routes import router as auth_router
from .incidents.routes import router as incidents_router
from .auth.dependencies import get_current_user
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from .crud import (
    create_supplier,
    delete_supplier,
    get_supplier,
    get_suppliers,
    update_supplier_rate,
    update_supplier_status,
)
from .models import Supplier, SupplierCreate, SupplierStatus


app = FastAPI(title="Brasaland Supplier Directory API")
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    errors = []

    for error in exc.errors():
        field = error["loc"][-1]

        errors.append(
            {
                "field": field,
                "message": error["msg"],
            }
        )

    return JSONResponse(
        status_code=400,
        content={"errors": errors},
    )
app.include_router(users_router)
app.include_router(profiles_router)
app.include_router(auth_router)
app.include_router(incidents_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RateUpdate(BaseModel):
    rate_per_unit: float = Field(gt=0)


class StatusUpdate(BaseModel):
    status: SupplierStatus


@app.get("/")
def root():
    return {"message": "Brasaland Supplier Directory API"}


@app.post("/suppliers", response_model=Supplier, status_code=201)
def register_supplier(
    supplier: SupplierCreate,
    current_user=Depends(get_current_user),
):
    return create_supplier(supplier.model_dump())


@app.get("/suppliers", response_model=list[Supplier])
def list_suppliers(
    country: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
):
    return get_suppliers(country=country, category=category)


@app.get("/suppliers/{supplier_id}", response_model=Supplier)
def supplier_detail(
    supplier_id: int,
    current_user=Depends(get_current_user),
):
    supplier = get_supplier(supplier_id)

    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    return supplier


@app.patch("/suppliers/{supplier_id}/rate", response_model=Supplier)
def change_supplier_rate(
    supplier_id: int,
    data: RateUpdate,
    current_user=Depends(get_current_user),
):
    supplier = update_supplier_rate(
        supplier_id,
        data.rate_per_unit,
    )

    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    return supplier


@app.patch("/suppliers/{supplier_id}/status", response_model=Supplier)
def change_supplier_status(
    supplier_id: int,
    data: StatusUpdate,
    current_user=Depends(get_current_user),
):
    supplier = update_supplier_status(
        supplier_id,
        data.status.value,
    )

    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    return supplier


@app.delete("/suppliers/{supplier_id}", status_code=204)
def remove_supplier(
    supplier_id: int,
    current_user=Depends(get_current_user),
):
    deleted = delete_supplier(supplier_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Supplier not found")

    return None
