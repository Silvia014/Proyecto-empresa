
from fastapi import APIRouter, Depends

from .supabase_dependencies import get_current_inventory_user


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me")
def read_current_user(
    current_user=Depends(get_current_inventory_user),
):
    return current_user
