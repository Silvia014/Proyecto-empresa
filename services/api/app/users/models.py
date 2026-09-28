from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    is_active: bool = True
    role: UserRole = UserRole.USER

class UserPublic(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    role: UserRole
    created_at: datetime

class User(BaseModel):
    id: int
    email: EmailStr
    hashed_password: str
    is_active: bool
    role: UserRole
    created_at: datetime

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
