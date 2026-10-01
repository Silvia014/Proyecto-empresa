from unittest.mock import patch

import pytest

from services.api.app.auth.routes import (
    ForgotPasswordRequest,
    forgot_password,
)


def test_forgot_password_happy_path():
    request = ForgotPasswordRequest(
        email="user@example.com",
    )

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value={"id": 1, "email": "user@example.com"},
    ), patch(
        "services.api.app.auth.routes.create_reset_token",
        return_value="reset-token",
    ) as mock_create_token, patch(
        "services.api.app.auth.routes.send_reset_email",
    ) as mock_send_email:

        result = forgot_password(request)

    assert result == {
        "message": "If that address is registered, you'll receive a link shortly."
    }
    mock_create_token.assert_called_once_with(1)
    mock_send_email.assert_called_once_with(
        "user@example.com",
        "reset-token",
    )


def test_forgot_password_edge_case_email_does_not_exist():
    request = ForgotPasswordRequest(
        email="unknown@example.com",
    )

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value=None,
    ), patch(
        "services.api.app.auth.routes.send_reset_email",
    ) as mock_send_email:

        result = forgot_password(request)

    assert result == {
        "message": "If that address is registered, you'll receive a link shortly."
    }
    mock_send_email.assert_not_called()


def test_forgot_password_failure_email_service_error():
    request = ForgotPasswordRequest(
        email="user@example.com",
    )

    with patch(
        "services.api.app.auth.routes.get_user_by_email",
        return_value={"id": 1, "email": "user@example.com"},
    ), patch(
        "services.api.app.auth.routes.create_reset_token",
        return_value="reset-token",
    ), patch(
        "services.api.app.auth.routes.send_reset_email",
        side_effect=RuntimeError("Email service unavailable"),
    ):
        with pytest.raises(RuntimeError):
            forgot_password(request)
