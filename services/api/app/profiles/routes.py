from fastapi import APIRouter, Depends, HTTPException
from ..auth.dependencies import get_current_user

from .crud import (
    create_profile,
    delete_profile,
    get_profile_by_user_id,
    update_profile,
)
from .models import Profile, ProfileCreate, ProfileUpdate


router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.post("", response_model=Profile, status_code=201)
def register_profile(
    profile: ProfileCreate,
    current_user=Depends(get_current_user),
) -> Profile:
    created_profile = create_profile(profile.model_dump(), current_user.id)

    if created_profile is None:
        raise HTTPException(
            status_code=409,
            detail="This user already has a profile.",
        )

    return created_profile


@router.get("/{user_id}", response_model=Profile)
def read_profile(
    user_id: int,
    current_user=Depends(get_current_user),
):
    profile = get_profile_by_user_id(user_id)

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Profile not found.",
        )

    return profile


@router.patch("/{user_id}", response_model=Profile)
def edit_profile(
    user_id: int,
    updates: ProfileUpdate,
    current_user=Depends(get_current_user),
):
    profile = update_profile(
        user_id,
        updates.model_dump(exclude_unset=True),
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Profile not found.",
        )

    return profile


@router.delete("/{user_id}", status_code=204)
def remove_profile(
    user_id: int,
    current_user=Depends(get_current_user),
):

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Profile not found.",
        )

    return None
