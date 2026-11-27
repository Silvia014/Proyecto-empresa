# Brasaland Operations MCP Server

OAuth-protected, Streamable HTTP MCP server for live Incident Manager and inventory data. The server is a separate process (`mcp` in Compose); the FastAPI API remains the system of record.

## Tools and least privilege

| Tool | Capability | Required scope | Backing source |
|---|---|---|---|
| `get_incident` | Read one incident by numeric ID | `incidents:read` | `GET /api/incidents/{id}` |
| `list_incidents` | Read incidents with optional status/origin/branch/category filters | `incidents:read` | `GET /api/incidents` |
| `create_incident` | Create an incident with validated title, description, category, origin and branch | `incidents:write` | `POST /api/incidents` |
| `update_incident_status` | Make a lifecycle transition; the Incident Manager validates allowed transitions | `incidents:write` | `PATCH /api/incidents/{id}/status?status=...` |
| `list_inventory_products` | Read products and calculated live stock; optional name filter | `inventory:read` | Existing inventory tables and `calculate_stocks()` |
| `reject_inventory_write` | Explicitly reject create/update/delete attempts | `mcp:access` | No database write path exists |

Every request also needs `mcp:access`. Inventory has no write scope and no write implementation. The explicit `reject_inventory_write` tool returns a clear read-only error. The MCP server logs tool, authenticated subject/client, and outcome, but never the bearer token or result payload.

## OAuth configuration

MCP Auth is used as an OAuth 2.1/OIDC **resource server**. It validates bearer JWTs issued by an external authorization server; this service does not issue tokens or create OAuth clients. Configure these values in `.env.local` (never commit secrets):

```dotenv
MCP_PUBLIC_URL=https://your-public-host.example
MCP_RESOURCE_URL=https://your-public-host.example/mcp
MCP_OAUTH_ISSUER=https://your-oauth-issuer.example
MCP_OAUTH_TYPE=oidc
```

Use `MCP_OAUTH_TYPE=oauth` if the issuer publishes OAuth Authorization Server Metadata rather than OIDC discovery. The provider must issue JWT access tokens whose `aud` matches `MCP_RESOURCE_URL` and whose scopes include `mcp:access` plus only the scopes each caller needs. Configure the issuer's signing keys/discovery document and register authorized MCP clients at that provider. Do not use a personal user token as a permanent service credential.

For the in-process LangGraph MCP client, configure a short-lived service access token in `MCP_AGENT_ACCESS_TOKEN`, with `mcp:access` and only the scopes the agent needs (`incidents:read` and/or `inventory:read`). Renew it through your identity provider's supported machine-to-machine flow. No issuer or OAuth client credentials have been provided in this repository, so real external token issuance must be configured with the identity provider before a protected client can connect.

## Run locally

1. Set the OAuth values above, plus the project's database values, in ignored `.env.local`.
2. Start the services with `docker compose up -d api mcp`.
3. Inspect logs with `docker compose logs -f mcp`; stop with `docker compose stop mcp`.
4. Health endpoint: `GET http://localhost:8300/healthz` (liveness only; it intentionally does not disclose provider configuration).
5. MCP Streamable HTTP endpoint: `http://localhost:8300/mcp`.

The public OAuth Protected Resource Metadata for the `/mcp` resource is served at `/.well-known/oauth-protected-resource/mcp`. Discovery is public; listing or invoking tools requires a valid bearer token with `mcp:access`. In GitHub Codespaces, set port 8300 to **Public**, then use the forwarded HTTPS URL as `MCP_PUBLIC_URL` and append `/mcp` for `MCP_RESOURCE_URL`. Only share the URL; never paste an access token into a public issue or chat.

## Agent integration

`services/api/app/rag/graph.py` routes operational ticket and inventory questions through `langchain-mcp-adapters` to this server. Policy/procedure questions continue through the existing RAG retrieval and grounded generation. Mixed ticket/policy questions retrieve RAG context and then call the live ticket tool. Each trace records the route, tool name, success/fallback, and RAG source names, without exposing raw tool results. MCP connection failures/timeouts produce a clear honest fallback; the agent never guesses ticket status or stock.

The Incident Manager's existing routes currently do not require authentication internally; the MCP boundary itself is protected by OAuth. The MCP server calls those routes over the private Compose network. Do not expose the MCP listener publicly without HTTPS termination and provider-issued OAuth tokens.

## Error behavior

- Missing/invalid bearer: HTTP `401` with the MCP Auth challenge/metadata.
- Missing tool scope: tool-level `insufficient_scope` error; no backend call occurs.
- Invalid lifecycle transition or input: clear validation/tool error from the Incident Manager.
- Unknown incident: not-found tool error.
- Upstream timeout: explicit 5-second Incident Manager timeout or adapter timeout; agent returns a fallback.
- Inventory write request: explicit read-only rejection; database remains unchanged.

Tool names, descriptions, argument enums and JSON schemas are advertised through standard MCP `tools/list` discovery; clients should discover tools rather than depend on private server implementation details.
