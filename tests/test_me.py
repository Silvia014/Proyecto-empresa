from unittest.mock import patch

import pytest
from fastapi import HTTPException

from services.api.app.auth.dependencies import get_current_user
from services.api.app.auth.routes import read_current_user


def test_me_happy_path():
    current_user = {
        "id": 1,
        "email": "user@example.com",
        "is_active": True,
        "role": "user",
    }

    result = read_current_user(current_user)

    assert result == current_user


def test_me_edge_case_inactive_user():
    user = {
        "id": 1,
        "email": "user@example.com",
        "is_active": False,
        "role": "user",
    }

    with patch(
        "services.api.app.auth.dependencies.decode_access_token",
        return_value={"sub": "1"},
    ), patch(
        "services.api.app.auth.dependencies.get_user",
        return_value=user,
    ):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user("valid-token")

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Inactive user."


def test_me_failure_invalid_token():
    from jose import JWTError

    with patch(
        "services.api.app.auth.dependencies.decode_access_token",
        side_effect=JWTError(),
    ):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user("invalid-token")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials."


def test_me_failure_user_not_found():
    with patch(
        "services.api.app.auth.dependencies.decode_access_token",
        return_value={"sub": "999"},
    ), patch(
        "services.api.app.auth.dependencies.get_user",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user("valid-token")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials."
