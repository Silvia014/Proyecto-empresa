import os

os.environ["DATABASE_URL"] = "sqlite:////tmp/serialization_audit_test.db"

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.database as app_database
import app.crud as app_crud
import app.incidents.crud as incidents_crud
import app.profiles.crud as profiles_crud
from app.incidents.models import IncidentRecord
from app.inventory.models import InventoryItem, InventoryMovement, Location
from app.main import app
from app.auth.supabase_dependencies import get_current_inventory_user
from app.database import get_db


TEST_ENGINE = create_engine(
    "sqlite:////tmp/serialization_audit_test.db",
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)


client = TestClient(app)


def reset_db():
    app_database.engine = TEST_ENGINE
    app_crud.engine = TEST_ENGINE
    incidents_crud.engine = TEST_ENGINE
    profiles_crud.engine = TEST_ENGINE
    SQLModel.metadata.drop_all(TEST_ENGINE)
    SQLModel.metadata.create_all(TEST_ENGINE)


def override_get_db():
    with Session(TEST_ENGINE) as session:
        yield session


reset_db()


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_inventory_user] = lambda: {
    "id": "user-123",
    "email": "ops@example.com",
    "is_active": True,
}


def seed_inventory_data():
    reset_db()

    with Session(TEST_ENGINE) as session:
        location = Location(
            id="TEST-LOC-1",
            name="Test Location",
            city="Test City",
            country="Test Country",
            currency="USD",
        )
        item = InventoryItem(
            location_id="TEST-LOC-1",
            name="Tomato",
            category="produce",
            unit_of_measure="kg",
            reorder_point=5,
        )
        session.add(location)
        session.add(item)
        session.commit()
        session.refresh(item)
        session.add(
            InventoryMovement(
                item_id=item.id,
                movement_type="inbound",
                quantity=25.5,
                reason="Restock",
                user_uuid="user-123",
            )
        )
        session.commit()


def seed_incident_data():
    reset_db()

    with Session(TEST_ENGINE) as session:
        session.add(
            IncidentRecord(
                title="Kitchen issue",
                description="Fridge failed",
                category="equipment_failure",
                status="open",
                origin="branch",
                branch="central",
            )
        )
        session.add(
            IncidentRecord(
                title="Supplier delay",
                description="Late delivery",
                category="delivery_issue",
                status="in_progress",
                origin="customer",
                branch="medellin_centro",
            )
        )
        session.commit()


def create_supplier_record():
    reset_db()
    payload = {
        "name": "Test Supplier",
        "country": "Colombia",
        "categories": ["verduras_y_hortalizas"],
        "rate_per_unit": 12.5,
        "currency": "COP",
        "status": "active",
        "contact_email": "supplier@example.com",
        "notes": "seeded for delete test",
    }
    response = client.post("/suppliers", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def test_auth_me_keeps_expected_fields_and_no_sensitive_keys():
    response = client.get("/auth/me")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"id", "email", "is_active"}
    assert payload["email"] == "ops@example.com"
    assert payload["is_active"] is True
    assert "password" not in payload
    assert "token" not in payload
    assert "secret" not in payload


def test_inventory_orders_summary_keeps_existing_fields():
    seed_inventory_data()

    response = client.get("/inventory/orders")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1
    row = payload[0]
    assert set(row.keys()) == {
        "id",
        "item_id",
        "product_name",
        "movement_type",
        "quantity",
        "lot_id",
        "reason",
        "created_at",
        "user_uuid",
    }
    assert row["product_name"] == "Tomato"
    assert row["quantity"] == 25.5
    assert row["user_uuid"] == "user-123"


def test_incident_summary_keeps_existing_field_names_and_semantics():
    seed_incident_data()

    response = client.get("/api/incidents/summary")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"total", "by_status", "by_origin", "by_category"}
    assert payload["total"] == 2
    assert payload["by_status"]["open"] == 1
    assert payload["by_status"]["in_progress"] == 1
    assert payload["by_origin"]["branch"] == 1
    assert payload["by_origin"]["customer"] == 1
    assert payload["by_category"]["equipment_failure"] == 1
    assert payload["by_category"]["delivery_issue"] == 1


def test_delete_supplier_endpoint_remains_204_without_body():
    supplier_id = create_supplier_record()

    response = client.delete(f"/suppliers/{supplier_id}")

    assert response.status_code == 204
    assert response.content == b""

