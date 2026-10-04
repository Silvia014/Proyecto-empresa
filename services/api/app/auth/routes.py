import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from ..users.crud import create_user, get_user_by_email, verify_password, update_user
from .password_reset import (
    create_reset_token,
    get_valid_reset_token,
    mark_reset_token_used,
    send_reset_email,
)
from ..users.models import UserPublic
from .dependencies import get_current_user
from .jwt import create_access_token


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=UserPublic, status_code=201)
def register(request: RegisterRequest):
    existing_user = get_user_by_email(request.email)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    user_data = {
        "email": request.email,
        "password": request.password,
        "is_active": True,
        "role": "user",
    }

    return create_user(user_data)


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user_by_email(form_data.username)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(
        form_data.password,
        user["hashed_password"],
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user.",
        )

    access_token = create_access_token(user["id"])

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserPublic)
def read_current_user(current_user=Depends(get_current_user)):
    return current_user

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    user = get_user_by_email(request.email)

    # Always return the same response, even if the email does not exist.
    if user is not None:
        token = create_reset_token(user["id"])
        try:
            send_reset_email(request.email, token)
        except Exception:
            logger.exception(
                "Password reset email delivery failed for %s",
                request.email,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password reset email could not be sent. Please try again later.",
            )

    return {
        "message": "If that address is registered, you'll receive a link shortly."
    }
@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest):
    reset_record = get_valid_reset_token(request.token)

    if reset_record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    update_user(
        reset_record["user_id"],
        {"password": request.new_password},
    )

    mark_reset_token_used(reset_record["id"])

    return {
        "message": "Password reset successfully."
    }
@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user),
):
    if not verify_password(
        request.current_password,
        current_user["hashed_password"],
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    update_user(
        current_user["id"],
        {"password": request.new_password},
    )

    return {
        "message": "Password changed successfully."
    }