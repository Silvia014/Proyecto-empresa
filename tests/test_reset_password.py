from unittest.mock import patch

import pytest
from fastapi import HTTPException

from services.api.app.auth.routes import (
    ResetPasswordRequest,
    reset_password,
)


def test_reset_password_happy_path():
    request = ResetPasswordRequest(
        token="valid-reset-token",
        new_password="NewPassword123!",
    )

    reset_record = {
        "id": 10,
        "user_id": 1,
        "token": "valid-reset-token",
    }

    with patch(
        "services.api.app.auth.routes.get_valid_reset_token",
        return_value=reset_record,
    ), patch(
        "services.api.app.auth.routes.update_user",
    ) as mock_update, patch(
        "services.api.app.auth.routes.mark_reset_token_used",
    ) as mock_mark_used:

        result = reset_password(request)

    assert result == {
        "message": "Password reset successfully."
    }

    mock_update.assert_called_once_with(
        1,
        {"password": "NewPassword123!"},
    )
    mock_mark_used.assert_called_once_with(10)


def test_reset_password_edge_case_invalid_token():
    request = ResetPasswordRequest(
        token="invalid-token",
        new_password="NewPassword123!",
    )

    with patch(
        "services.api.app.auth.routes.get_valid_reset_token",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            reset_password(request)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid or expired reset token."


def test_reset_password_failure_expired_token():
    request = ResetPasswordRequest(
        token="expired-token",
        new_password="NewPassword123!",
    )

    with patch(
        "services.api.app.auth.routes.get_valid_reset_token",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            reset_password(request)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid or expired reset token."
