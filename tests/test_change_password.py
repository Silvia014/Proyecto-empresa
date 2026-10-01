from unittest.mock import patch

import pytest
from fastapi import HTTPException

from services.api.app.auth.routes import (
    ChangePasswordRequest,
    change_password,
)


def test_change_password_happy_path():
    request = ChangePasswordRequest(
        current_password="OldPassword123!",
        new_password="NewPassword123!",
    )

    current_user = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": "hashed-old-password",
        "is_active": True,
    }

    with patch(
        "services.api.app.auth.routes.verify_password",
        return_value=True,
    ), patch(
        "services.api.app.auth.routes.update_user",
    ) as mock_update:

        result = change_password(request, current_user)

    assert result == {
        "message": "Password changed successfully."
    }

    mock_update.assert_called_once_with(
        1,
        {"password": "NewPassword123!"},
    )


def test_change_password_edge_case_wrong_current_password():
    request = ChangePasswordRequest(
        current_password="WrongPassword!",
        new_password="NewPassword123!",
    )

    current_user = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": "hashed-old-password",
        "is_active": True,
    }

    with patch(
        "services.api.app.auth.routes.verify_password",
        return_value=False,
    ):
        with pytest.raises(HTTPException) as exc_info:
            change_password(request, current_user)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Current password is incorrect."


def test_change_password_failure_does_not_update_password_when_current_is_wrong():
    request = ChangePasswordRequest(
        current_password="WrongPassword!",
        new_password="NewPassword123!",
    )

    current_user = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": "hashed-old-password",
        "is_active": True,
    }

    with patch(
        "services.api.app.auth.routes.verify_password",
        return_value=False,
    ), patch(
        "services.api.app.auth.routes.update_user",
    ) as mock_update:

        with pytest.raises(HTTPException):
            change_password(request, current_user)

    mock_update.assert_not_called()
