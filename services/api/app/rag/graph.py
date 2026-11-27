"""Traceable routing between Brasaland RAG and live MCP tools."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Literal, TypedDict
from uuid import uuid4

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph

from data.pipelines.rag import generate_answer, retrieve

logger = logging.getLogger(__name__)


class AgentState(TypedDict, total=False):
    question: str
    route: Literal["rag", "mcp", "both", "clarify"]
    tool_name: str
    tool_args: dict[str, Any]
    missing_fields: list[str]
    context: list[dict[str, Any]]
    answer: str
    error: str
    trace: list[dict[str, Any]]


INCIDENT_ID = re.compile(r"\b(?:ticket|incident|incidente)\s*#?\s*(\d+)\b", re.I)
INVENTORY_WORDS = re.compile(r"\b(stock|inventory|inventario|existencias|disponibilidad)\b", re.I)
INCIDENT_WORDS = re.compile(r"\b(ticket|incident|incidente|incidencia)\b", re.I)
POLICY_WORDS = re.compile(r"\b(policy|pol[ií]tica|procedure|procedimiento|how do|c[oó]mo|allerg|alerg|points|puntos)\b", re.I)


def route_question(question: str) -> dict[str, Any]:
    """Choose an MCP tool for live operational data, RAG for policies, or both."""
    text = question.strip()
    incident_id = INCIDENT_ID.search(text)
    if INVENTORY_WORDS.search(text):
        route = "both" if POLICY_WORDS.search(text) else "mcp"
        return {"route": route, "tool_name": "list_inventory_products", "tool_args": {"query": _inventory_query(text)}}
    if incident_id:
        if re.search(r"\b(update|change|mark|set|cambiar|actualizar|poner|pasar)\b", text, re.I):
            status = _requested_status(text)
            if status:
                return {
                    "route": "mcp",
                    "tool_name": "update_incident_status",
                    "tool_args": {"incident_id": int(incident_id.group(1)), "status": status},
                }
            return {"route": "clarify", "tool_name": "", "tool_args": {}}
        route = "both" if POLICY_WORDS.search(text) else "mcp"
        return {"route": route, "tool_name": "get_incident", "tool_args": {"incident_id": int(incident_id.group(1))}}
    if INCIDENT_WORDS.search(text):
        if re.search(r"\b(create|open|report|file|crear|abrir|reportar)\b", text, re.I):
            fields = _incident_fields(text)
            missing = [name for name in ("title", "description", "category", "origin", "branch") if not fields.get(name)]
            if missing:
                return {"route": "clarify", "tool_name": "", "tool_args": {}, "missing_fields": missing}
            return {"route": "mcp", "tool_name": "create_incident", "tool_args": fields}
        return {"route": "mcp", "tool_name": "list_incidents", "tool_args": {}}
    return {"route": "rag", "tool_name": "", "tool_args": {}}


def _inventory_query(question: str) -> str | None:
    cleaned = re.sub(
        r"\b(?:how much|do we have|what is|what's|cu[aá]nto|cu[aá]nta|tenemos|hay|"
        r"stock|inventory|inventario|"
        r"existencias|disponibilidad|de|del|of|for|para|the|el|la)\b",
        " ",
        question,
        flags=re.I,
    )
    cleaned = re.sub(r"[^\w -]", " ", cleaned)
    return " ".join(cleaned.split()) or None


def _requested_status(question: str) -> str | None:
    mappings = {
        "in_progress": r"\b(in progress|in_progress|working|en curso|en progreso)\b",
        "resolved": r"\b(resolved|complete|completed|resuelto|resuelta|solucionado|solucionada)\b",
        "discarded": r"\b(discarded|cancelled|canceled|descartado|descartada|cancelado|cancelada)\b",
        "open": r"\b(open|reopen|abierto|abierta)\b",
    }
    return next((status for status, pattern in mappings.items() if re.search(pattern, question, re.I)), None)


def _incident_fields(question: str) -> dict[str, str]:
    """Read explicitly labelled incident fields; do not infer missing values."""
    fields = {"title", "description", "category", "origin", "branch"}
    pattern = re.compile(
        r"(?:^|[;|]\s*)(title|description|category|origin|branch)\s*[:=]\s*"
        r"(.*?)(?=\s*[;|]\s*(?:title|description|category|origin|branch)\s*[:=]|$)",
        re.I | re.S,
    )
    parsed = {match.group(1).lower(): match.group(2).strip().strip(" ;|") for match in pattern.finditer(question)}
    return {key: value for key, value in parsed.items() if key in fields and value}


def validate_question(state: AgentState) -> AgentState:
    question = state.get("question", "").strip()
    if not question:
        return {
            "error": "Escribe una pregunta para consultar la base de conocimiento.",
            "trace": [{"node": "validate_question", "status": "invalid"}],
        }
    return {"question": question, "trace": [{"node": "validate_question", "status": "valid"}]}


def choose_route(state: AgentState) -> AgentState:
    decision = route_question(state["question"])
    event = {"node": "route_question", "status": "completed", "route": decision["route"], "tool": decision["tool_name"] or None}
    return {**decision, "trace": [*state.get("trace", []), event]}


def _invoke_mcp_tool(tool_name: str, arguments: dict[str, Any]) -> Any:
    """Call the remote MCP server through langchain-mcp-adapters (never the API directly)."""
    async def invoke() -> Any:
        from langchain_mcp_adapters.client import MultiServerMCPClient

        url = os.getenv("MCP_SERVER_URL", "http://localhost:8300/mcp").strip()
        token = os.getenv("MCP_AGENT_ACCESS_TOKEN", "").strip()
        if not token:
            raise RuntimeError("MCP_AGENT_ACCESS_TOKEN is not configured for the agent MCP client.")
        client = MultiServerMCPClient({
            "brasaland": {
                "transport": "streamable_http",
                "url": url,
                "headers": {"Authorization": f"Bearer {token}"},
                "timeout": 7.0,
            }
        })
        available = await client.get_tools(server_name="brasaland")
        selected = next((tool for tool in available if tool.name == tool_name), None)
        if selected is None:
            raise RuntimeError(f"MCP server did not advertise required tool {tool_name}.")
        return await selected.ainvoke(arguments)

    return asyncio.run(invoke())


def retrieve_context(state: AgentState) -> AgentState:
    context = retrieve(state["question"])
    previous = state.get("trace", [])
    event = {
        "node": "retrieve_context", "status": "completed", "chunks_found": len(context),
        "sources": sorted({str(chunk.get("source_document", "unknown")) for chunk in context}),
    }
    return {"context": context, "trace": [*previous, event]}


def call_mcp_tool(state: AgentState) -> AgentState:
    tool_name, arguments = state["tool_name"], state.get("tool_args", {})
    try:
        result = _invoke_mcp_tool(tool_name, arguments)
    except Exception as exc:
        logger.warning("Agent MCP tool failed tool=%s error_type=%s", tool_name, type(exc).__name__)
        return {
            "error": "No pude confirmar ese dato operativo ahora mismo. El servicio de datos en vivo no respondió; inténtalo de nuevo más tarde.",
            "trace": [*state.get("trace", []), {"node": "mcp_tool", "status": "fallback", "tool": tool_name, "error_type": type(exc).__name__}],
        }
    context_item = {
        "source_document": f"live MCP tool: {tool_name}",
        "section": "Live operational result",
        "language": "en",
        "text": json.dumps(result, ensure_ascii=False, default=str),
    }
    return {
        "context": [*state.get("context", []), context_item],
        "trace": [*state.get("trace", []), {"node": "mcp_tool", "status": "completed", "tool": tool_name}],
    }


def clarify_request(state: AgentState) -> AgentState:
    question = state["question"]
    if re.search(r"\b(create|open|report|file|crear|abrir|reportar)\b", question, re.I):
        missing = ", ".join(state.get("missing_fields", [])) or "title, description, category, origin and branch"
        answer = f"Puedo crear el ticket, pero necesito estos campos explícitos: {missing}. Usa los valores de categoría, origen y sucursal admitidos por el gestor."
    else:
        answer = "Indica el estado al que quieres cambiar el ticket: in_progress, resolved o discarded. El gestor validará si la transición está permitida."
    return {"answer": answer, "trace": [*state.get("trace", []), {"node": "clarify_request", "status": "completed"}]}


def generate_response(state: AgentState) -> AgentState:
    answer = generate_answer(state["question"], state.get("context", []))
    return {"answer": answer, "trace": [*state.get("trace", []), {"node": "generate_answer", "status": "completed"}]}


def fallback_response(state: AgentState) -> AgentState:
    return {
        "answer": state.get("error", "No pude completar la consulta."),
        "trace": [*state.get("trace", []), {"node": "fallback_response", "status": "completed"}],
    }


def after_validation(state: AgentState) -> str:
    return "invalid" if state.get("error") else "valid"


def after_routing(state: AgentState) -> str:
    return state["route"]


def after_tool(state: AgentState) -> str:
    return "fallback" if state.get("error") else "generate"


def build_graph(checkpointer: SqliteSaver):
    builder = StateGraph(AgentState)
    builder.add_node("validate_question", validate_question)
    builder.add_node("route_question", choose_route)
    builder.add_node("retrieve_context", retrieve_context)
    builder.add_node("mcp_tool", call_mcp_tool)
    builder.add_node("generate_answer", generate_response)
    builder.add_node("clarify_request", clarify_request)
    builder.add_node("fallback_response", fallback_response)
    builder.add_edge(START, "validate_question")
    builder.add_conditional_edges("validate_question", after_validation, {"valid": "route_question", "invalid": END})
    builder.add_conditional_edges("route_question", after_routing, {
        "rag": "retrieve_context", "mcp": "mcp_tool", "both": "retrieve_context", "clarify": "clarify_request",
    })
    builder.add_conditional_edges("retrieve_context", lambda state: "mcp" if state.get("tool_name") else "generate", {"mcp": "mcp_tool", "generate": "generate_answer"})
    builder.add_conditional_edges("mcp_tool", after_tool, {"generate": "generate_answer", "fallback": "fallback_response"})
    builder.add_edge("generate_answer", END)
    builder.add_edge("fallback_response", END)
    builder.add_edge("clarify_request", END)
    return builder.compile(checkpointer=checkpointer)


PROJECT_ROOT = Path(__file__).resolve().parents[4]
checkpoint_path = Path(os.getenv("RAG_CHECKPOINT_DB", str(PROJECT_ROOT / "data/eval/rag-checkpoints.sqlite")))
if not checkpoint_path.is_absolute():
    checkpoint_path = PROJECT_ROOT / checkpoint_path
checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
_checkpoint_connection = sqlite3.connect(str(checkpoint_path), check_same_thread=False)
checkpointer = SqliteSaver(_checkpoint_connection)
graph = build_graph(checkpointer)


def get_run_trace(run_id: str) -> list[dict[str, Any]]:
    config = {"configurable": {"thread_id": run_id}}
    snapshots = list(graph.get_state_history(config))
    events = []
    for snapshot in reversed(snapshots):
        state_trace = snapshot.values.get("trace", [])
        if state_trace:
            event = state_trace[-1]
            events.append({
                "step": snapshot.metadata.get("step"), "node": event.get("node"),
                "status": event.get("status"), "details": event, "next": list(snapshot.next),
            })
    return events


def run_agent(question: str) -> dict[str, Any]:
    run_id = str(uuid4())
    config = {"configurable": {"thread_id": run_id}}
    try:
        result = graph.invoke({"question": question, "trace": []}, config=config)
        trace = get_run_trace(run_id)
    except Exception:
        logger.exception("Agent graph execution failed run_id=%s", run_id)
        return {"run_id": run_id, "status": "failure", "answer": None, "error": "The knowledge agent could not complete the request.", "trace": get_run_trace(run_id)}
    if result.get("error") and not result.get("answer"):
        return {"run_id": run_id, "status": "invalid", "answer": None, "error": result["error"], "trace": trace}
    return {"run_id": run_id, "status": "success", "answer": result.get("answer"), "error": None, "trace": trace}
