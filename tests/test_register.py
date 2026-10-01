from unittest.mock import patch

import pytest
from fastapi import HTTPException

from services.api.app.auth.routes import RegisterRequest, register


def test_register_happy_path():
    request = RegisterRequest(
        email="newuser@example.com",
        password="StrongPassword123!",
    )

    expected_user = {
        "id": 1,
        "email": "newuser@example.com",
        "is_active": True,
        "role": "user",
        "created_at": "2026-01-01T00:00:00+00:00",
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=None,
    ), patch(
        "services.api.app.auth.routes.create_user",
        return_value=expected_user,
    ) as mock_create:

        result = register(request)

    assert result["email"] == "newuser@example.com"
    assert result["role"] == "user"
    mock_create.assert_called_once()


def test_register_edge_case_email_is_case_insensitive():
    request = RegisterRequest(
        email="USER@example.com",
        password="StrongPassword123!",
    )

    existing_user = {
        "id": 1,
        "email": "user@example.com",
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=existing_user,
    ):
        with pytest.raises(HTTPException) as exc_info:
            register(request)

    assert exc_info.value.status_code == 409


def test_register_failure_duplicate_user():
    request = RegisterRequest(
        email="existing@example.com",
        password="StrongPassword123!",
    )

    existing_user = {
        "id": 1,
        "email": "existing@example.com",
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=existing_user,
    ):
        with pytest.raises(HTTPException) as exc_info:
            register(request)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "A user with this email already exists."
