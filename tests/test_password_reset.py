from datetime import datetime, timedelta, timezone

from tinydb import TinyDB

from services.api.app.auth import password_reset


def test_create_reset_token_stores_token(tmp_path, monkeypatch):
    db = TinyDB(tmp_path / "test.json")
    table = db.table("password_reset_tokens")
    monkeypatch.setattr(
        password_reset,
        "password_reset_tokens_table",
        table,
    )

    token = password_reset.create_reset_token(1)

    assert token
    records = table.all()

    assert len(records) == 1
    assert records[0]["user_id"] == 1
    assert records[0]["token"] == token
    assert records[0]["used"] is False

    db.close()


def test_get_valid_reset_token_returns_valid_token(tmp_path, monkeypatch):
    db = TinyDB(tmp_path / "test.json")
    table = db.table("password_reset_tokens")

    table.insert(
        {
            "user_id": 1,
            "token": "valid-token",
            "expires_at": (
                datetime.now(timezone.utc) + timedelta(minutes=30)
            ).isoformat(),
            "used": False,
        }
    )

    monkeypatch.setattr(
        password_reset,
        "password_reset_tokens_table",
        table,
    )

    result = password_reset.get_valid_reset_token("valid-token")

    assert result is not None
    assert result["user_id"] == 1
    assert result["token"] == "valid-token"

    db.close()


def test_get_valid_reset_token_returns_none_for_missing_token(tmp_path, monkeypatch):
    db = TinyDB(tmp_path / "test.json")
    table = db.table("password_reset_tokens")

    monkeypatch.setattr(
        password_reset,
        "password_reset_tokens_table",
        table,
    )

    result = password_reset.get_valid_reset_token("missing-token")

    assert result is None

    db.close()


def test_get_valid_reset_token_returns_none_for_used_token(
    tmp_path,
    monkeypatch,
):
    db = TinyDB(tmp_path / "test.json")
    table = db.table("password_reset_tokens")

    table.insert(
        {
            "user_id": 1,
            "token": "used-token",
            "expires_at": (
                datetime.now(timezone.utc) + timedelta(minutes=30)
            ).isoformat(),
            "used": True,
        }
    )

    monkeypatch.setattr(
        password_reset,
        "password_reset_tokens_table",
        table,
    )

    result = password_reset.get_valid_reset_token("used-token")

    assert result is None

    db.close()


def test_get_valid_reset_token_returns_none_for_expired_token(
    tmp_path,
    monkeypatch,
):
    db = TinyDB(tmp_path / "test.json")
    table = db.table("password_reset_tokens")

    table.insert(
        {
            "user_id": 1,
            "token": "expired-token",
            "expires_at": (
                datetime.now(timezone.utc) - timedelta(minutes=1)
            ).isoformat(),
            "used": False,
        }
    )

    monkeypatch.setattr(
        password_reset,
        "password_reset_tokens_table",
        table,
    )

    result = password_reset.get_valid_reset_token("expired-token")

    assert result is None

    db.close()


def test_mark_reset_token_used(tmp_path, monkeypatch):
    db = TinyDB(tmp_path / "test.json")
    table = db.table("password_reset_tokens")

    token_id = table.insert(
        {
            "user_id": 1,
            "token": "token-to-use",
            "expires_at": (
                datetime.now(timezone.utc) + timedelta(minutes=30)
            ).isoformat(),
            "used": False,
        }
    )

    monkeypatch.setattr(
        password_reset,
        "password_reset_tokens_table",
        table,
    )

    password_reset.mark_reset_token_used(token_id)

    assert table.get(doc_id=token_id)["used"] is True

    db.close()
