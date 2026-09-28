from typing import List

from fastapi import APIRouter, Depends, HTTPException
from ..auth.dependencies import get_current_user

from .crud import create_user, delete_user, get_user, get_user_by_email, update_user
from .models import User, UserCreate, UserUpdate, UserPublic


router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserPublic, status_code=201)
def register_user(user: UserCreate):
    existing_user = get_user_by_email(user.email)

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists.",
        )

    return create_user(user.model_dump())


@router.get("", response_model=List[User])
def list_users():
    from ..database import users_table

    return [
        {
            "id": user.doc_id,
            **user,
        }
        for user in users_table.all()
    ]


@router.get("/{user_id}", response_model=UserPublic)
def read_user(user_id: int):
    user = get_user(user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    return user


@router.patch("/{user_id}", response_model=UserPublic)
def edit_user(user_id: int, updates: UserUpdate):
    user = update_user(
        user_id,
        updates.model_dump(exclude_unset=True),
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    return user


@router.delete("/{user_id}", status_code=204)
def remove_user(user_id: int):
    deleted = delete_user(user_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    return None
