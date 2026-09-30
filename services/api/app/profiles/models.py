from pydantic import BaseModel


class Profile(BaseModel):
    id: int
    user_id: int
    name: str
    phone: str
    address: str


class ProfileCreate(BaseModel):
    name: str
    phone: str
    address: str


class ProfileUpdate(BaseModel):
    name: str
    phone: str
    address: str