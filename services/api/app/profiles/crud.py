from typing import Optional

from ..database import profiles_table


def create_profile(profile_data: dict) -> Optional[dict]:
    user_id = profile_data["user_id"]

    existing_profile = profiles_table.search(
        lambda profile: profile["user_id"] == user_id
    )

    if existing_profile:
        return None

    profile_id = profiles_table.insert(profile_data)

    return {
        "id": profile_id,
        **profile_data,
    }


def get_profile(profile_id: int) -> Optional[dict]:
    profile = profiles_table.get(doc_id=profile_id)

    if profile is None:
        return None

    return {
        "id": profile.doc_id,
        **profile,
    }


def get_profile_by_user_id(user_id: int) -> Optional[dict]:
    profiles = profiles_table.search(
        lambda profile: profile["user_id"] == user_id
    )

    if not profiles:
        return None

    profile = profiles[0]

    return {
        "id": profile.doc_id,
        **profile,
    }


def update_profile(user_id: int, updates: dict) -> Optional[dict]:
    profile = get_profile_by_user_id(user_id)

    if profile is None:
        return None

    profiles_table.update(
        updates,
        doc_ids=[profile["id"]],
    )

    return get_profile_by_user_id(user_id)


def delete_profile(user_id: int) -> bool:
    profile = get_profile_by_user_id(user_id)

    if profile is None:
        return False

    profiles_table.remove(doc_ids=[profile["id"]])

    return True
