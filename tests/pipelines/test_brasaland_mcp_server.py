"""Offline security and discovery checks for the Brasaland MCP tools."""

import asyncio

import pytest
from fastmcp.exceptions import ToolError
from mcpauth import AuthInfo
from mcpauth import MCPAuth
from mcpauth.config import AuthServerConfig, AuthServerType, AuthorizationServerMetadata
from mcpauth.types import ResourceServerConfig, ResourceServerMetadata
from starlette.testclient import TestClient
from services.api.app.incidents.models import IncidentStatus

from mcps.brasaland import server


def _auth(scopes):
    return AuthInfo(
        token="test-token",
        issuer="https://issuer.example",
        client_id="agent-test",
        scopes=scopes,
        subject="unit-test",
        audience="https://mcp.example/mcp",
        claims={},
    )


def test_http_resource_metadata_is_public_and_mcp_endpoint_requires_bearer():
    issuer = AuthServerConfig(
        metadata=AuthorizationServerMetadata(
            issuer="https://issuer.example",
            authorization_endpoint="https://issuer.example/authorize",
            token_endpoint="https://issuer.example/token",
            jwks_uri="https://issuer.example/jwks",
            response_types_supported=["code"],
        ),
        type=AuthServerType.OIDC,
    )
    resource_url = "https://mcp.example/mcp"
    auth = MCPAuth(
        protected_resources=ResourceServerConfig(
            metadata=ResourceServerMetadata(
                resource=resource_url,
                authorization_servers=[issuer],
                scopes_supported=["mcp:access", "incidents:read"],
            )
        )
    )
    app = server.create_app(auth=auth, resource_url=resource_url)

    with TestClient(app) as client:
        metadata = client.get("/.well-known/oauth-protected-resource/mcp")
        protected = client.get("/mcp")

    assert metadata.status_code == 200
    assert "incidents:read" in metadata.json()["scopes_supported"]
    assert protected.status_code == 401
    assert protected.headers["www-authenticate"].startswith("Bearer")


def test_discovery_lists_descriptive_incident_and_read_only_inventory_tools():
    async def list_tools():
        return await server.mcp.list_tools()

    tools = asyncio.run(list_tools())
    by_name = {tool.name: tool for tool in tools}

    assert {"get_incident", "list_incidents", "create_incident", "update_incident_status", "list_inventory_products", "reject_inventory_write"} <= set(by_name)
    assert "Requires incidents:read" in by_name["get_incident"].description
    assert "cannot change" in by_name["list_inventory_products"].description
    assert "Explicitly reject" in by_name["reject_inventory_write"].description
    assert "status" in by_name["update_incident_status"].parameters["properties"]


def test_inventory_write_tool_explicitly_rejects_without_touching_storage():
    async def invoke():
        server._auth_context.set(_auth(["mcp:access"]))
        tool = await server.mcp.get_tool("reject_inventory_write")
        await tool.fn("delete", product_id=42)

    with pytest.raises(ToolError, match="read-only through MCP"):
        asyncio.run(invoke())


def test_inventory_read_scope_is_required_before_repository_access():
    server._auth_context.set(_auth(["mcp:access"]))

    with pytest.raises(ToolError, match="insufficient_scope"):
        server._auth_info(("inventory:read",), "list_inventory_products")


def test_update_tool_calls_lifecycle_specific_endpoint(monkeypatch):
    calls = []

    async def fake_request(method, path, *, params=None, json_body=None):
        calls.append((method, path, params, json_body))
        return {"id": 7, "status": "resolved"}

    async def invoke():
        server._auth_context.set(_auth(["incidents:write"]))
        monkeypatch.setattr(server, "_incident_request", fake_request)
        tool = await server.mcp.get_tool("update_incident_status")
        return await tool.fn(7, IncidentStatus.RESOLVED)

    result = asyncio.run(invoke())

    assert result["status"] == "resolved"
    assert calls == [("PATCH", "/api/incidents/7/status", {"status": "resolved"}, None)]


def test_wrong_scope_is_rejected_before_incident_request(monkeypatch):
    async def fail_if_called(*args, **kwargs):
        raise AssertionError("backend must not be called without incidents:read")

    async def invoke():
        server._auth_context.set(_auth(["mcp:access", "inventory:read"]))
        monkeypatch.setattr(server, "_incident_request", fail_if_called)
        tool = await server.mcp.get_tool("get_incident")
        await tool.fn(8)

    with pytest.raises(ToolError, match="insufficient_scope"):
        asyncio.run(invoke())
