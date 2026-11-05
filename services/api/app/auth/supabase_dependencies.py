import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

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


ROLE_PERMISSIONS = {
    "superadmin": {"suppliers", "locations", "customers", "orders", "reservations", "candidates", "inventory", "brasapuntos", "profile"},
    "admin": {"suppliers", "locations", "customers", "orders", "reservations", "candidates", "inventory", "brasapuntos", "profile"},
    "manager_hr": {"locations", "customers", "candidates", "inventory", "profile"},
    "marketing": {"locations", "customers", "suppliers", "profile"},
    "economato": {"locations", "suppliers", "orders", "inventory", "profile"},
    "chef": {"suppliers", "locations", "customers", "orders", "reservations", "inventory", "brasapuntos", "profile"},
    "staff": {"locations", "customers", "orders", "reservations", "brasapuntos", "profile"},
}


def _get_staff_role(supabase_url: str, user_id: str):
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY")
    if not service_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_SERVICE_ROLE_KEY is not configured in the API.",
        )
    url = (
        f"{supabase_url.rstrip('/')}/rest/v1/staff_profiles"
        f"?user_id=eq.{quote(user_id)}&select=role,email"
    )
    request = Request(
        url,
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
    )
    try:
        with urlopen(request, timeout=5) as response:
            rows = json.loads(response.read().decode("utf-8"))
        if not isinstance(rows, list):
            raise ValueError("Unexpected staff profile response")
        return rows[0] if rows else None
    except HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The staff role table is missing. Apply the staff role migration.",
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify staff access with Supabase.",
        )
    except (URLError, TimeoutError, ValueError, OSError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify staff access with Supabase.",
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

        profile = _get_staff_role(supabase_url, user_id)
        if not profile or profile.get("role") not in ROLE_PERMISSIONS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account does not have staff access.",
            )
        email = (claims.get("email") or "").strip().lower()
        if profile["role"] == "superadmin" and email != "roldansilvi@gmail.com":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superadmin access is reserved for the owner account.",
            )

        return {
            "id": user_id,
            "email": claims.get("email"),
            "role": profile["role"],
            "is_active": True,
        }

    except HTTPException:
        raise
    except (JWTError, ValueError, TypeError):
        raise _unauthorized()


def require_permission(permission: str):
    def dependency(current_user=Depends(get_current_inventory_user)):
        permissions = ROLE_PERMISSIONS.get(current_user.get("role"), set())
        if permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your staff role does not have access to this section.",
            )
        return current_user

    return dependency
