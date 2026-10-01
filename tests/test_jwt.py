from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from jose import JWTError, jwt

from services.api.app.auth.jwt import (
    create_access_token,
    decode_access_token,
)
from services.api.app.auth.config import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
)


def test_create_access_token_contains_user_id_and_expiration():
    token = create_access_token(123)

    payload = decode_access_token(token)

    assert payload["sub"] == "123"
    assert "exp" in payload


def test_decode_access_token_rejects_invalid_token():
    with pytest.raises(JWTError):
        decode_access_token("this-is-not-a-valid-token")


def test_decode_access_token_rejects_expired_token():
    expired_payload = {
        "sub": "123",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }

    token = jwt.encode(
        expired_payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_access_token(token)
