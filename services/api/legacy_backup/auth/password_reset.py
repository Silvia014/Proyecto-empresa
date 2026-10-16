from datetime import datetime, timedelta, timezone
import os
import secrets

import resend

from ..database import password_reset_tokens_table


RESET_TOKEN_EXPIRE_MINUTES = 30


def create_reset_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    ).isoformat()

    password_reset_tokens_table.insert(
        {
            "user_id": user_id,
            "token": token,
            "expires_at": expires_at,
            "used": False,
        }
    )

    return token


def get_valid_reset_token(token: str):
    records = password_reset_tokens_table.search(
        lambda item: item["token"] == token
    )

    if not records:
        return None

    reset_record = records[0]

    if reset_record["used"]:
        return None

    expires_at = datetime.fromisoformat(reset_record["expires_at"])

    if datetime.now(timezone.utc) >= expires_at:
        return None

    return {
        "id": reset_record.doc_id,
        **reset_record,
    }


def mark_reset_token_used(token_id: int) -> None:
    password_reset_tokens_table.update(
        {"used": True},
        doc_ids=[token_id],
    )


def send_reset_email(email: str, token: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")

    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    resend.api_key = api_key

    reset_link = f"http://localhost:3000/reset-password?token={token}"

    resend.Emails.send(
        {
            "from": "Brasaland <onboarding@resend.dev>",
            "to": [email],
            "subject": "Reset your Brasaland password",
            "html": f"""
                <h2>Password reset</h2>
                <p>You requested a password reset for your Brasaland account.</p>
                <p>
                    <a href="{reset_link}">
                        Reset your password
                    </a>
                </p>
                <p>This link expires in 30 minutes.</p>
            """,
        }
    )
