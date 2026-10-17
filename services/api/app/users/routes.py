
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/users", tags=["Users"])


def legacy_auth_disabled():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "The legacy user API has been retired. "
            "Use Supabase Auth for user registration, "
            "authentication and account management."
        ),
    )


@router.post("", status_code=status.HTTP_410_GONE)
def register_user():
    legacy_auth_disabled()


@router.get("", status_code=status.HTTP_410_GONE)
def list_users():
    legacy_auth_disabled()


@router.get("/{user_id}", status_code=status.HTTP_410_GONE)
def read_user(user_id: int):
    legacy_auth_disabled()


@router.patch("/{user_id}", status_code=status.HTTP_410_GONE)
def edit_user(user_id: int):
    legacy_auth_disabled()


@router.delete("/{user_id}", status_code=status.HTTP_410_GONE)
def remove_user(user_id: int):
    legacy_auth_disabled()
