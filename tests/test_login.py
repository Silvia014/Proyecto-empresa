from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from services.api.app.auth.routes import login


def test_login_happy_path():
    form_data = SimpleNamespace(
        username="user@example.com",
        password="CorrectPassword123!",
    )

    user = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": "hashed-password",
        "is_active": True,
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=user,
    ), patch(
        "services.api.app.auth.routes.verify_password",
        return_value=True,
    ), patch(
        "services.api.app.auth.routes.create_access_token",
        return_value="test-access-token",
    ) as mock_token:

        result = login(form_data)

    assert result == {
        "access_token": "test-access-token",
        "token_type": "bearer",
    }
    mock_token.assert_called_once_with(1)


def test_login_edge_case_email_is_case_insensitive():
    form_data = SimpleNamespace(
        username="USER@example.com",
        password="CorrectPassword123!",
    )

    user = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": "hashed-password",
        "is_active": True,
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=user,
    ), patch(
        "services.api.app.auth.routes.verify_password",
        return_value=True,
    ), patch(
        "services.api.app.auth.routes.create_access_token",
        return_value="test-access-token",
    ):

        result = login(form_data)

    assert result["access_token"] == "test-access-token"


def test_login_failure_wrong_password():
    form_data = SimpleNamespace(
        username="user@example.com",
        password="WrongPassword!",
    )

    user = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": "hashed-password",
        "is_active": True,
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=user,
    ), patch(
        "services.api.app.auth.routes.verify_password",
        return_value=False,
    ):
        with pytest.raises(HTTPException) as exc_info:
            login(form_data)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Incorrect email or password."


def test_login_failure_user_not_found():
    form_data = SimpleNamespace(
        username="missing@example.com",
        password="SomePassword123!",
    )

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            login(form_data)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Incorrect email or password."


def test_login_failure_inactive_user():
    form_data = SimpleNamespace(
        username="inactive@example.com",
        password="CorrectPassword123!",
    )

    user = {
        "id": 2,
        "email": "inactive@example.com",
        "hashed_password": "hashed-password",
        "is_active": False,
    }

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=user,
    ), patch(
        "services.api.app.auth.routes.verify_password",
        return_value=True,
    ):
        with pytest.raises(HTTPException) as exc_info:
            login(form_data)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Inactive user."
