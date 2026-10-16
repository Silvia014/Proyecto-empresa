
from typing import Optional

from pydantic import BaseModel, ConfigDict


class Profile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    phone: str
    address: str


class ProfileCreate(BaseModel):
    name: str
    phone: str
    address: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
