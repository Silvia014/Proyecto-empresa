from datetime import datetime, timezone
from typing import Optional

from passlib.hash import bcrypt

from ..database import users_table


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.verify(password, hashed_password)


def create_user(user_data: dict) -> dict:
    hashed_password = hash_password(user_data["password"])

    user = {
        "email": user_data["email"],
        "hashed_password": hashed_password,
        "is_active": user_data.get("is_active", True),
        "role": user_data.get("role", "user"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    user_id = users_table.insert(user)

    return {
        "id": user_id,
        **user,
    }


def get_user(user_id: int) -> Optional[dict]:
    user = users_table.get(doc_id=user_id)

    if user is None:
        return None

    return {
        "id": user.doc_id,
        **user,
    }


def get_user_by_email(email: str) -> Optional[dict]:
    for user in users_table.all():
        if user["email"].lower() == email.lower():
            return {
                "id": user.doc_id,
                **user,
            }

    return None


def update_user(user_id: int, updates: dict) -> Optional[dict]:
    user = users_table.get(doc_id=user_id)

    if user is None:
        return None

    clean_updates = {
        key: value
        for key, value in updates.items()
        if value is not None
    }

    if "password" in clean_updates:
        clean_updates["hashed_password"] = hash_password(
            clean_updates.pop("password")
        )

    users_table.update(clean_updates, doc_ids=[user_id])

    return get_user(user_id)


def delete_user(user_id: int) -> bool:
    user = users_table.get(doc_id=user_id)

    if user is None:
        return False

    users_table.remove(doc_ids=[user_id])

    return True
