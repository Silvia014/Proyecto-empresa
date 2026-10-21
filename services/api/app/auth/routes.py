
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from .supabase_dependencies import get_current_inventory_user


class AuthUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: Optional[str] = None
    is_active: bool = True


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me", response_model=AuthUserResponse)
def read_current_user(
    current_user=Depends(get_current_inventory_user),
):
    return current_user
