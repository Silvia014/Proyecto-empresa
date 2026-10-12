import json
import os
import time
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt


bearer_scheme = HTTPBearer()
_jwks_cache = {"keys": [], "expires_at": 0}


def _unauthorized():
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Supabase credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _get_jwks(url: str):
    now = time.monotonic()

    if _jwks_cache["keys"] and now < _jwks_cache["expires_at"]:
        return _jwks_cache["keys"]

    try:
        with urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
        keys = data.get("keys", [])
        if not keys:
            raise ValueError("No signing keys returned")

        _jwks_cache["keys"] = keys
        _jwks_cache["expires_at"] = now + 300
        return keys
    except (URLError, TimeoutError, ValueError, OSError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase signing keys are temporarily unavailable.",
        )


def get_current_inventory_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")

    if not supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL is not configured in the API.",
        )

    issuer = f"{supabase_url}/auth/v1"
    jwks_url = f"{issuer}/.well-known/jwks.json"

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        key_id = header.get("kid")

        if algorithm not in {"ES256", "RS256"} or not key_id:
            raise _unauthorized()

        keys = _get_jwks(jwks_url)
        signing_key = next(
            (
                key for key in keys
                if key.get("kid") == key_id
                and key.get("alg", algorithm) == algorithm
            ),
            None,
        )

        if signing_key is None:
            raise _unauthorized()

        claims = jwt.decode(
            token,
            signing_key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=issuer,
        )

        user_id = claims.get("sub")
        if not user_id:
            raise _unauthorized()

        return {
            "id": user_id,
            "email": claims.get("email"),
            "is_active": True,
        }

    except HTTPException:
        raise
    except (JWTError, ValueError, TypeError):
        raise _unauthorized()
