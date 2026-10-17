
from fastapi.testclient import TestClient

from services.api.app.main import app
from services.api.app.auth.supabase_dependencies import (
    get_current_inventory_user,
)


def fake_supabase_user():
    return {
        "id": "d09c12d0-d3f2-4af2-8c72-5b935c0b8dc7",
        "email": "silvia@aibosolutions.com",
        "is_active": True,
    }


def test_auth_me_returns_authenticated_supabase_user():
    app.dependency_overrides[get_current_inventory_user] = (
        fake_supabase_user
    )

    try:
        with TestClient(app) as client:
            response = client.get("/auth/me")

        assert response.status_code == 200
        assert response.json()["email"] == "silvia@aibosolutions.com"
        assert response.json()["is_active"] is True
    finally:
        app.dependency_overrides.pop(
            get_current_inventory_user,
            None,
        )


def test_auth_me_requires_authentication():
    with TestClient(app) as client:
        response = client.get("/auth/me")

        assert response.status_code == 401
