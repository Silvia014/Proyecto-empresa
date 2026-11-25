import json
import time
from urllib.error import URLError

from services.api.app.rag import tools
from services.api.app.rag.tools import (
    IncidentLookupInput,
    InventoryLookupInput,
    lookup_inventory,
)


def test_incident_adapter_uses_read_only_get_and_explicit_timeout(monkeypatch):
    now = "2026-11-25T10:00:00Z"
    body = {
        "id": 482,
        "title": "POS terminal offline",
        "description": "The terminal is offline.",
        "status": "in_progress",
        "category": "pos_system",
        "origin": "branch",
        "branch": "central",
        "created_at": now,
        "updated_at": now,
    }
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return json.dumps(body).encode()

    def fake_urlopen(request, timeout):
        captured["method"] = request.get_method()
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setenv("INCIDENTS_API_URL", "http://incidents.internal:8000")
    monkeypatch.setattr(tools, "urlopen", fake_urlopen)

    result = tools.lookup_incidents(IncidentLookupInput(ticket_id=482))

    assert result.status == "success"
    assert result.incidents[0].id == 482
    assert result.incidents[0].status == "in_progress"
    assert captured == {
        "method": "GET",
        "url": "http://incidents.internal:8000/api/incidents/482",
        "timeout": 4.0,
    }


def test_incident_adapter_reports_transport_timeout(monkeypatch):
    def timeout_urlopen(_request, timeout):
        assert timeout == 4.0
        raise URLError(TimeoutError("request timed out"))

    monkeypatch.setattr(tools, "urlopen", timeout_urlopen)

    result = tools.lookup_incidents(IncidentLookupInput(ticket_id=482))

    assert result.status == "timeout"
    assert result.incidents == []


def test_inventory_tool_enforces_staff_inventory_permission(monkeypatch):
    def must_not_read(_request):
        raise AssertionError("Inventory service was called without permission.")

    monkeypatch.setattr(tools, "_read_inventory_products", must_not_read)
    result = lookup_inventory(
        InventoryLookupInput(product_name="Sirloin"),
        actor_role="marketing",
    )

    assert result.status == "forbidden"
    assert result.products == []


def test_inventory_tool_returns_timeout_when_stock_read_is_slow(monkeypatch):
    def slow_read(_request):
        time.sleep(0.05)
        return [], False

    monkeypatch.setattr(tools, "_read_inventory_products", slow_read)
    result = lookup_inventory(
        InventoryLookupInput(product_name="Sirloin"),
        actor_role="chef",
        timeout=0.001,
    )

    assert result.status == "timeout"
