"""Remote OAuth-protected MCP server for Brasaland incidents and inventory."""

from __future__ import annotations

import asyncio
import logging
import os
from contextvars import ContextVar
from typing import Any, Literal

import httpx
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from mcpauth import AuthInfo, MCPAuth
from mcpauth.config import AuthServerType
from mcpauth.types import ResourceServerConfig, ResourceServerMetadata
from mcpauth.utils import fetch_server_config
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from services.api.app.incidents.models import (
    IncidentCategory,
    IncidentCreate,
    IncidentOrigin,
    IncidentStatus,
)

logger = logging.getLogger("brasaland.mcp")
REQUEST_TIMEOUT_SECONDS = 5.0
_auth_context: ContextVar[AuthInfo | None] = ContextVar("brasaland_mcp_auth", default=None)

mcp = FastMCP(
    name="Brasaland Operations",
    instructions=(
        "Manage support incidents and read current inventory. Incident tools can create tickets, "
        "read tickets, and transition status through the incident lifecycle. Inventory is strictly "
        "read-only; never claim to change stock or product records. Tool results are live service data."
    ),
)


def _auth_info(required_scopes: tuple[str, ...], tool_name: str) -> AuthInfo:
    info = _auth_context.get()
    if info is None:
        raise ToolError("Authentication required. Obtain an OAuth access token and retry.")
    missing = sorted(set(required_scopes) - set(info.scopes))
    if missing:
        logger.warning(
            "mcp_tool_invoked tool=%s subject=%s client_id=%s outcome=denied_insufficient_scope missing_scopes=%s",
            tool_name,
            info.subject,
            info.client_id or "unknown",
            ",".join(missing),
        )
        raise ToolError(
            "insufficient_scope: this tool requires " + " ".join(required_scopes)
        )
    return info


def _audit(tool_name: str, info: AuthInfo, outcome: str) -> None:
    logger.info(
        "mcp_tool_invoked tool=%s subject=%s client_id=%s outcome=%s",
        tool_name,
        info.subject,
        info.client_id or "unknown",
        outcome,
    )


def _incident_api_base_url() -> str:
    return os.getenv("INCIDENTS_API_BASE_URL", "http://localhost:8000").rstrip("/")


async def _incident_request(
    method: str,
    path: str,
    *,
    params: dict[str, str] | None = None,
    json_body: dict[str, Any] | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(
            base_url=_incident_api_base_url(), timeout=REQUEST_TIMEOUT_SECONDS
        ) as client:
            response = await client.request(
                method, path, params=params, json=json_body
            )
    except httpx.TimeoutException as exc:
        raise ToolError("Incident Manager did not respond within 5 seconds.") from exc
    except httpx.HTTPError as exc:
        raise ToolError("Incident Manager is temporarily unavailable.") from exc

    if response.status_code == 404:
        raise ToolError("The requested incident does not exist.")
    if response.status_code in {400, 422}:
        detail = response.json().get("detail", "The incident request is invalid.")
        raise ToolError(f"Incident request rejected: {detail}")
    if response.status_code >= 500:
        raise ToolError("Incident Manager is temporarily unavailable.")
    if response.status_code >= 400:
        raise ToolError(f"Incident Manager rejected the request (HTTP {response.status_code}).")
    if response.status_code == 204:
        return {"updated": True}
    return response.json()


@mcp.tool
async def get_incident(incident_id: int) -> dict[str, Any]:
    """Read one live support ticket by its numeric ID. Returns title, description, status, category, origin, branch and timestamps. Requires incidents:read."""
    info = _auth_info(("incidents:read",), "get_incident")
    try:
        result = await _incident_request("GET", f"/api/incidents/{incident_id}")
    except Exception:
        _audit("get_incident", info, "failure")
        raise
    _audit("get_incident", info, "success")
    return result


@mcp.tool
async def list_incidents(
    status: IncidentStatus | None = None,
    origin: IncidentOrigin | None = None,
    branch: str | None = None,
    category: IncidentCategory | None = None,
) -> list[dict[str, Any]]:
    """Search current support tickets. Optional filters are status, origin, branch, and category; values must match the Incident Manager enums. Requires incidents:read."""
    info = _auth_info(("incidents:read",), "list_incidents")
    params = {
        key: value.value if hasattr(value, "value") else value
        for key, value in {
            "status": status,
            "origin": origin,
            "branch": branch,
            "category": category,
        }.items()
        if value is not None
    }
    try:
        result = await _incident_request("GET", "/api/incidents", params=params)
    except Exception:
        _audit("list_incidents", info, "failure")
        raise
    _audit("list_incidents", info, "success")
    return result


@mcp.tool
async def create_incident(
    title: str,
    description: str,
    category: IncidentCategory,
    origin: IncidentOrigin,
    branch: str,
) -> dict[str, Any]:
    """Create a support ticket in the existing Incident Manager. Requires title, description, valid category, origin and branch. New tickets begin in open status. Requires incidents:write."""
    info = _auth_info(("incidents:write",), "create_incident")
    try:
        payload = IncidentCreate(
            title=title,
            description=description,
            category=category,
            origin=origin,
            branch=branch,
        ).model_dump(mode="json")
        result = await _incident_request("POST", "/api/incidents", json_body=payload)
    except Exception:
        _audit("create_incident", info, "failure")
        raise
    _audit("create_incident", info, "success")
    return result


@mcp.tool
async def update_incident_status(
    incident_id: int,
    status: IncidentStatus,
) -> dict[str, Any]:
    """Transition a ticket using the Incident Manager lifecycle endpoint. Only valid transitions are accepted (open → in_progress/discarded; in_progress → resolved/discarded). Requires incidents:write."""
    info = _auth_info(("incidents:write",), "update_incident_status")
    try:
        result = await _incident_request(
            "PATCH",
            f"/api/incidents/{incident_id}/status",
            params={"status": status.value},
        )
    except Exception:
        _audit("update_incident_status", info, "failure")
        raise
    _audit("update_incident_status", info, "success")
    return result


def _read_inventory_products(query: str | None) -> list[dict[str, Any]]:
    """Read the existing inventory repository and its canonical stock calculation."""
    from sqlmodel import Session, select

    from services.api.app.database import engine
    from services.api.app.inventory.models import InventoryItem
    from services.api.app.inventory.services import calculate_stocks

    with Session(engine) as session:
        items = session.exec(select(InventoryItem).order_by(InventoryItem.name)).all()
        stocks = calculate_stocks(session, items)
        normalized_query = (query or "").casefold().strip()
        return [
            {
                "id": item.id,
                "location_id": item.location_id,
                "name": item.name,
                "category": item.category,
                "unit_of_measure": item.unit_of_measure,
                "reorder_point": item.reorder_point,
                "current_stock": stocks.get(item.id, 0),
                "below_reorder": stocks.get(item.id, 0) <= item.reorder_point,
            }
            for item in items
            if not normalized_query or normalized_query in item.name.casefold()
        ]


@mcp.tool
async def list_inventory_products(query: str | None = None) -> list[dict[str, Any]]:
    """Read live inventory products and calculated current stock, optionally filtered by product-name substring. This tool cannot change products or stock. Requires inventory:read."""
    info = _auth_info(("inventory:read",), "list_inventory_products")
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_read_inventory_products, query),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        _audit("list_inventory_products", info, "timeout")
        raise ToolError("Inventory did not respond within 5 seconds; no data was changed.") from exc
    except Exception as exc:
        logger.exception("Inventory read failed subject=%s", info.subject)
        _audit("list_inventory_products", info, "failure")
        raise ToolError("Inventory is temporarily unavailable; no data was changed.") from exc
    _audit("list_inventory_products", info, "success")
    return result


@mcp.tool
async def reject_inventory_write(
    operation: Literal["create", "update", "delete"],
    product_id: int | None = None,
) -> None:
    """Explicitly reject an attempted inventory create, update or delete. Inventory access through this MCP server is read-only; use the authorized ERP inventory workflow for changes. This tool never writes data."""
    info = _auth_context.get()
    if info is not None:
        _audit("reject_inventory_write", info, "denied_read_only")
    raise ToolError(
        f"Inventory is read-only through MCP: the requested {operation} operation was rejected and no data was changed."
    )


def _required_setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Set {name} before starting the Brasaland MCP server.")
    return value


def _build_auth(resource_url: str, issuer: str, auth_type: str) -> MCPAuth:
    try:
        server_type = AuthServerType(auth_type.lower())
    except ValueError as exc:
        raise RuntimeError("MCP_OAUTH_TYPE must be 'oidc' or 'oauth'.") from exc

    # Discovery happens at server startup so invalid issuer metadata fails before the
    # endpoint is advertised as ready.
    authorization_server = fetch_server_config(issuer, server_type)
    resource_metadata = ResourceServerMetadata(
        resource=resource_url,
        authorization_servers=[authorization_server],
        scopes_supported=[
            "mcp:access",
            "incidents:read",
            "incidents:write",
            "inventory:read",
        ],
        resource_name="Brasaland Operations MCP",
        resource_documentation="https://github.com/Silvia014/Proyecto-empresa/tree/main/mcps/brasaland",
    )
    return MCPAuth(
        protected_resources=ResourceServerConfig(metadata=resource_metadata),
        context_var=_auth_context,
    )


async def healthz(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "brasaland-mcp"})


def create_app(
    *,
    auth: MCPAuth | None = None,
    verifier: Any | None = None,
    resource_url: str | None = None,
) -> Starlette:
    """Create the OAuth-protected Streamable HTTP app; injectable auth supports offline tests."""
    public_url = (os.getenv("MCP_PUBLIC_URL", "http://localhost:8300").strip().rstrip("/"))
    resolved_resource = resource_url or os.getenv(
        "MCP_RESOURCE_URL", f"{public_url}/mcp"
    ).strip()
    resolved_auth = auth or _build_auth(
        resolved_resource,
        _required_setting("MCP_OAUTH_ISSUER"),
        os.getenv("MCP_OAUTH_TYPE", "oidc"),
    )
    auth_middleware = Middleware(
        resolved_auth.bearer_auth_middleware(
            verifier or "jwt",
            audience=resolved_resource,
            required_scopes=["mcp:access"],
            resource=resolved_resource,
        )
    )
    mcp_http_app = mcp.http_app(
        path="/mcp", transport="streamable-http", stateless_http=True
    )
    metadata_routes = resolved_auth.resource_metadata_router().routes
    return Starlette(
        routes=[
            *metadata_routes,
            Route("/healthz", healthz, methods=["GET"]),
            Mount("/", app=mcp_http_app, middleware=[auth_middleware]),
        ],
        lifespan=mcp_http_app.lifespan,
    )


def main() -> None:
    import uvicorn

    app = create_app()
    uvicorn.run(
        app,
        host=os.getenv("MCP_HOST", "0.0.0.0"),
        port=int(os.getenv("MCP_PORT", "8300")),
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )


if __name__ == "__main__":
    main()
