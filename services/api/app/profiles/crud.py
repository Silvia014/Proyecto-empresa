
from typing import Optional

from sqlalchemy import text

from ..database import engine


def _to_dict(row) -> Optional[dict]:
    if row is None:
        return None

    profile_id = str(row["id"])

    return {
        "id": profile_id,
        "user_id": profile_id,
        "name": row["full_name"] or "",
        "phone": row["phone"] or "",
        "address": row["address"] or "",
    }


def get_profile_by_user_id(user_id: str) -> Optional[dict]:
    with engine.connect() as connection:
        row = connection.execute(
            text("""
                SELECT id, full_name, phone, address
                FROM public.profiles
                WHERE id = CAST(:user_id AS uuid)
            """),
            {"user_id": str(user_id)},
        ).mappings().first()

    return _to_dict(row)


def create_profile(profile_data: dict) -> Optional[dict]:
    user_id = str(profile_data["user_id"])

    # Supabase may already have created the profile through its trigger.
    existing = get_profile_by_user_id(user_id)

    if existing is not None:
        return update_profile(user_id, profile_data)

    with engine.begin() as connection:
        connection.execute(
            text("""
                INSERT INTO public.profiles
                    (id, email, full_name, phone, address)
                VALUES (
                    CAST(:user_id AS uuid),
                    :email,
                    :name,
                    :phone,
                    :address
                )
                ON CONFLICT (id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address
            """),
            {
                "user_id": user_id,
                "email": profile_data.get("email"),
                "name": profile_data.get("name", ""),
                "phone": profile_data.get("phone", ""),
                "address": profile_data.get("address", ""),
            },
        )

    return get_profile_by_user_id(user_id)


def update_profile(
    user_id: str,
    updates: dict,
) -> Optional[dict]:
    field_mapping = {
        "name": "full_name",
        "phone": "phone",
        "address": "address",
    }

    values = {
        field_mapping[key]: value
        for key, value in updates.items()
        if key in field_mapping
    }

    if not values:
        return get_profile_by_user_id(user_id)

    assignments = ", ".join(
        f"{column} = :{column}" for column in values
    )

    values["user_id"] = str(user_id)

    with engine.begin() as connection:
        result = connection.execute(
            text(f"""
                UPDATE public.profiles
                SET {assignments}
                WHERE id = CAST(:user_id AS uuid)
            """),
            values,
        )

        if result.rowcount == 0:
            return None

    return get_profile_by_user_id(user_id)


def delete_profile(user_id: str) -> bool:
    with engine.begin() as connection:
        result = connection.execute(
            text("""
                DELETE FROM public.profiles
                WHERE id = CAST(:user_id AS uuid)
            """),
            {"user_id": str(user_id)},
        )

    return result.rowcount > 0
