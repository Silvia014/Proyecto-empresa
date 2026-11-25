"""LangGraph flow for the Brasaland knowledge and live incident assistant."""

from __future__ import annotations

import logging
import os
import sqlite3
from pathlib import Path
from typing import Any, TypedDict
from uuid import uuid4

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph

from data.pipelines.rag import (
    classify_agent_question,
    generate_answer,
    generate_answer_with_live_sources,
    retrieve,
)
from .tools import (
    IncidentLookupInput,
    IncidentLookupResult,
    InventoryLookupInput,
    InventoryLookupResult,
    lookup_incidents,
    lookup_inventory,
)

logger = logging.getLogger(__name__)


class AgentState(TypedDict, total=False):
    question: str
    route: str
    incident_query: dict[str, Any]
    inventory_query: dict[str, Any]
    actor_role: str
    context: list[dict[str, Any]]
    incident_result: dict[str, Any]
    inventory_result: dict[str, Any]
    answer: str
    error: str
    trace: list[dict[str, Any]]


def _append_trace(state: AgentState, entry: dict[str, Any]) -> list[dict[str, Any]]:
    return [*state.get("trace", []), entry]


def validate_question(state: AgentState) -> AgentState:
    question = state.get("question", "").strip()
    if not question:
        return {
            "error": "Escribe una pregunta para consultar la base de conocimiento.",
            "trace": [{"node": "validate_question", "status": "invalid"}],
        }
    return {
        "question": question,
        "trace": [{"node": "validate_question", "status": "valid"}],
    }


def classify_request(state: AgentState) -> AgentState:
    """Ask the configured model which existing source(s) can answer the question."""
    try:
        raw_decision = classify_agent_question(state["question"])
        route = raw_decision["route"]
        if route == "both":
            tool = raw_decision.get("tool")
            if tool not in {"incident", "inventory"}:
                raise ValueError("The router did not select a live tool for a combined query.")
            route = f"both_{tool}"
        incident_query = IncidentLookupInput(
            ticket_id=raw_decision.get("ticket_id"),
            status=raw_decision.get("status"),
            origin=raw_decision.get("origin"),
            category=raw_decision.get("category"),
            branch=raw_decision.get("branch"),
        ).model_dump(exclude_none=True)
        product_name = raw_decision.get("product_name")
        location_id = raw_decision.get("location_id")
        inventory_query = InventoryLookupInput(
            product_name=product_name.strip() if isinstance(product_name, str) and product_name.strip() else None,
            location_id=location_id.strip() if isinstance(location_id, str) and location_id.strip() else None,
        ).model_dump(exclude_none=True)
        trace_entry = {
            "node": "classify_request",
            "status": "completed",
            "route": route,
            "sources": ["knowledge_base", "incident_service"]
            if route == "both_incident"
            else ["knowledge_base", "inventory_service"]
            if route == "both_inventory"
            else ["incident_service"]
            if route == "incident"
            else ["inventory_service"]
            if route == "inventory"
            else ["knowledge_base"],
        }
        return {
            "route": route,
            "incident_query": incident_query,
            "inventory_query": inventory_query,
            "trace": _append_trace(state, trace_entry),
        }
    except Exception:
        # Retrieval is the safe fallback: its answer generator refuses to invent
        # facts when no policy/document context supports an answer.
        logger.exception("Agent source classification failed")
        return {
            "route": "rag",
            "incident_query": {},
            "inventory_query": {},
            "trace": _append_trace(
                state,
                {
                    "node": "classify_request",
                    "status": "fallback",
                    "route": "rag",
                    "reason": "classification_unavailable",
                },
            ),
        }


def retrieve_context(state: AgentState) -> AgentState:
    context = retrieve(state["question"])
    trace_entry = {
        "node": "retrieve_context",
        "status": "completed",
        "chunks_found": len(context),
        "sources": sorted(
            {str(chunk.get("source_document", "unknown")) for chunk in context}
        ),
    }
    return {
        "context": context,
        "trace": _append_trace(state, trace_entry),
    }


def lookup_incident(state: AgentState) -> AgentState:
    """Call the existing read-only incidents API through its typed adapter."""
    try:
        request = IncidentLookupInput.model_validate(state.get("incident_query", {}))
        result = lookup_incidents(request)
    except Exception:
        logger.exception("Incident tool failed")
        result = IncidentLookupResult(status="unavailable")

    result_data = result.model_dump(mode="json")
    trace_entry = {
        "node": "lookup_incident",
        "status": result.status,
        "ticket_id": state.get("incident_query", {}).get("ticket_id"),
        "records_found": len(result.incidents),
    }
    return {
        "incident_result": result_data,
        "trace": _append_trace(state, trace_entry),
    }


def lookup_inventory_tool(state: AgentState) -> AgentState:
    """Read stock through the existing inventory service layer with role checks."""
    try:
        request = InventoryLookupInput.model_validate(state.get("inventory_query", {}))
        result = lookup_inventory(request, actor_role=state.get("actor_role"))
    except Exception:
        logger.exception("Inventory tool failed")
        result = InventoryLookupResult(status="unavailable")

    trace_entry = {
        "node": "lookup_inventory",
        "status": result.status,
        "records_found": len(result.products),
        "truncated": result.truncated,
    }
    return {
        "inventory_result": result.model_dump(mode="json"),
        "trace": _append_trace(state, trace_entry),
    }


def generate_with_context(state: AgentState) -> AgentState:
    answer = generate_answer(state["question"], state.get("context", []))
    return {
        "answer": answer,
        "trace": _append_trace(
            state,
            {"node": "generate_with_context", "status": "completed"},
        ),
    }


def answer_without_context(state: AgentState) -> AgentState:
    answer = generate_answer(state["question"], [])
    return {
        "answer": answer,
        "trace": _append_trace(
            state,
            {"node": "answer_without_context", "status": "completed"},
        ),
    }


def generate_from_sources(state: AgentState) -> AgentState:
    live_results = {}
    if "incident_result" in state:
        live_results["incident_service"] = state["incident_result"]
    if "inventory_result" in state:
        live_results["inventory_service"] = state["inventory_result"]
    answer = generate_answer_with_live_sources(
        state["question"],
        state.get("context", []),
        live_results,
    )
    return {
        "answer": answer,
        "trace": _append_trace(
            state,
            {"node": "generate_from_sources", "status": "completed"},
        ),
    }


def after_validation(state: AgentState) -> str:
    return "invalid" if state.get("error") else "valid"


def after_classification(state: AgentState) -> str:
    return state.get("route", "rag")


def after_retrieval(state: AgentState) -> str:
    if state.get("route") == "both_incident":
        return "incident"
    if state.get("route") == "both_inventory":
        return "inventory"
    return "has_context" if state.get("context") else "no_context"


def build_graph(checkpointer: SqliteSaver):
    builder = StateGraph(AgentState)
    builder.add_node("validate_question", validate_question)
    builder.add_node("classify_request", classify_request)
    builder.add_node("retrieve_context", retrieve_context)
    builder.add_node("lookup_incident", lookup_incident)
    builder.add_node("lookup_inventory", lookup_inventory_tool)
    builder.add_node("generate_with_context", generate_with_context)
    builder.add_node("answer_without_context", answer_without_context)
    builder.add_node("generate_from_sources", generate_from_sources)

    builder.add_edge(START, "validate_question")
    builder.add_conditional_edges(
        "validate_question",
        after_validation,
        {"valid": "classify_request", "invalid": END},
    )
    builder.add_conditional_edges(
        "classify_request",
        after_classification,
        {
            "rag": "retrieve_context",
            "incident": "lookup_incident",
            "inventory": "lookup_inventory",
            "both_incident": "retrieve_context",
            "both_inventory": "retrieve_context",
        },
    )
    builder.add_conditional_edges(
        "retrieve_context",
        after_retrieval,
        {
            "has_context": "generate_with_context",
            "no_context": "answer_without_context",
            "incident": "lookup_incident",
            "inventory": "lookup_inventory",
        },
    )
    builder.add_edge("lookup_incident", "generate_from_sources")
    builder.add_edge("lookup_inventory", "generate_from_sources")
    builder.add_edge("generate_with_context", END)
    builder.add_edge("answer_without_context", END)
    builder.add_edge("generate_from_sources", END)

    # Compilation validates graph structure before any request is executed.
    return builder.compile(checkpointer=checkpointer)


PROJECT_ROOT = Path(__file__).resolve().parents[4]
checkpoint_path = Path(
    os.getenv(
        "RAG_CHECKPOINT_DB",
        str(PROJECT_ROOT / "data/eval/rag-checkpoints.sqlite"),
    )
)
if not checkpoint_path.is_absolute():
    checkpoint_path = PROJECT_ROOT / checkpoint_path
checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
_checkpoint_connection = sqlite3.connect(str(checkpoint_path), check_same_thread=False)
checkpointer = SqliteSaver(_checkpoint_connection)

# Compile at import time so structural errors surface before serving requests.
graph = build_graph(checkpointer)


def get_run_trace(run_id: str) -> list[dict[str, Any]]:
    config = {"configurable": {"thread_id": run_id}}
    snapshots = list(graph.get_state_history(config))
    events = []
    for snapshot in reversed(snapshots):
        state_trace = snapshot.values.get("trace", [])
        if not state_trace:
            continue
        event = state_trace[-1]
        events.append(
            {
                "step": snapshot.metadata.get("step"),
                "node": event.get("node"),
                "status": event.get("status"),
                "details": event,
                "next": list(snapshot.next),
            }
        )
    return events


def run_agent(question: str, *, actor: dict[str, Any] | None = None) -> dict[str, Any]:
    run_id = str(uuid4())
    config = {"configurable": {"thread_id": run_id}}
    initial_state: AgentState = {"question": question, "trace": []}
    if actor and isinstance(actor.get("role"), str):
        initial_state["actor_role"] = actor["role"]
    try:
        result = graph.invoke(initial_state, config=config)
        trace = get_run_trace(run_id)
    except Exception:
        logger.exception("Agent graph execution failed run_id=%s", run_id)
        return {
            "run_id": run_id,
            "status": "failure",
            "answer": None,
            "error": "The knowledge agent could not complete the request.",
            "trace": get_run_trace(run_id),
        }

    if result.get("error"):
        return {
            "run_id": run_id,
            "status": "invalid",
            "answer": None,
            "error": result["error"],
            "trace": trace,
        }
    return {
        "run_id": run_id,
        "status": "success",
        "answer": result.get("answer"),
        "error": None,
        "trace": trace,
    }
