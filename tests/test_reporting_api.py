from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.reporting import routes


def _client():
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_current_inventory_user] = (
        lambda: {"id": "test-user", "is_active": True}
    )
    return TestClient(app)


def test_latest_pipeline_run_endpoint(monkeypatch):
    expected = {"run_id": "run-123", "status": "completed"}
    monkeypatch.setattr(routes, "get_latest_pipeline_run", lambda: expected)

    response = _client().get("/reporting/pipeline-runs/latest")

    assert response.status_code == 200
    assert response.json() == {"run": expected}


def test_weekly_performance_endpoint_passes_filters(monkeypatch):
    expected = {"week_start": "2026-11-02", "locations": []}
    captured = {}

    def fake_get_report(**kwargs):
        captured.update(kwargs)
        return expected

    monkeypatch.setattr(
        routes, "get_weekly_location_performance", fake_get_report
    )

    response = _client().get(
        "/reporting/weekly-location-performance",
        params={
            "week_start": "2026-11-02",
            "location_id": "CO-MDE-01",
            "country": "CO",
            "limit": 20,
        },
    )

    assert response.status_code == 200
    assert response.json() == expected
    assert captured["week_start"].isoformat() == "2026-11-02"
    assert captured["location_id"] == "CO-MDE-01"
    assert captured["country"] == "CO"
    assert captured["limit"] == 20


def test_manual_pipeline_trigger_returns_accepted(monkeypatch):
    calls = []

    monkeypatch.setattr(
        routes,
        "_run_pipeline_in_background",
        lambda week_start, run_id: calls.append((week_start, run_id)),
    )

    response = _client().post(
        "/reporting/pipeline-runs",
        json={"week_start": "2026-11-02"},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "accepted"
    assert payload["week_start"] == "2026-11-02"
    assert payload["run_id"]
    assert calls == [("2026-11-02", payload["run_id"])]


def test_manual_pipeline_trigger_rejects_non_monday():
    response = _client().post(
        "/reporting/pipeline-runs",
        json={"week_start": "2026-11-03"},
    )
    assert response.status_code == 400
