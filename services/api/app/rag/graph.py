"""LangGraph flow for the Brasaland knowledge assistant."""

from typing import Any, TypedDict
import os
import sqlite3
from pathlib import Path
from uuid import uuid4
import logging
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
logger = logging.getLogger(__name__)

class AgentState(TypedDict, total=False):
    question: str
    context: list[dict[str, Any]]
    answer: str
    error: str
    trace: list[dict[str, Any]]

from data.pipelines.rag import generate_answer, retrieve


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


def retrieve_context(state: AgentState) -> AgentState:
    question = state["question"]
    context = retrieve(question)

    previous_trace = state.get("trace", [])
    trace_entry = {
        "node": "retrieve_context",
        "status": "completed",
        "chunks_found": len(context),
        "sources": sorted({
            str(chunk.get("source_document", "unknown"))
            for chunk in context
        }),
    }

    return {
        "context": context,
        "trace": [*previous_trace, trace_entry],
    }


def generate_with_context(state: AgentState) -> AgentState:
    answer = generate_answer(state["question"], state.get("context", []))
    return {
        "answer": answer,
        "trace": [
            *state.get("trace", []),
            {"node": "generate_with_context", "status": "completed"},
        ],
    }


def answer_without_context(state: AgentState) -> AgentState:
    # Reuse the existing grounded generator. It is instructed to admit
    # when the knowledge base does not contain enough information.
    answer = generate_answer(state["question"], [])
    return {
        "answer": answer,
        "trace": [
            *state.get("trace", []),
            {"node": "answer_without_context", "status": "completed"},
        ],
    }

def after_validation(state: AgentState) -> str:
    return "invalid" if state.get("error") else "valid"


def after_retrieval(state: AgentState) -> str:
    return "no_context" if not state.get("context") else "has_context"


def build_graph(checkpointer: SqliteSaver):
    builder = StateGraph(AgentState)

    builder.add_node("validate_question", validate_question)
    builder.add_node("retrieve_context", retrieve_context)
    builder.add_node("generate_with_context", generate_with_context)
    builder.add_node("answer_without_context", answer_without_context)

    builder.add_edge(START, "validate_question")
    builder.add_conditional_edges(
        "validate_question",
        after_validation,
        {"valid": "retrieve_context", "invalid": END},
    )
    builder.add_conditional_edges(
        "retrieve_context",
        after_retrieval,
        {
            "has_context": "generate_with_context",
            "no_context": "answer_without_context",
        },
    )
    builder.add_edge("generate_with_context", END)
    builder.add_edge("answer_without_context", END)

    # compile() comprueba la estructura antes de ejecutar una consulta.
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
_checkpoint_connection = sqlite3.connect(
    str(checkpoint_path),
    check_same_thread=False,
)
checkpointer = SqliteSaver(_checkpoint_connection)

# El grafo queda compilado al importar este módulo, antes de atender consultas.
graph = build_graph(checkpointer)

def get_run_trace(run_id: str) -> list[dict[str, Any]]:
    config = {"configurable": {"thread_id": run_id}}
    snapshots = list(graph.get_state_history(config))
    events = []

    # LangGraph entrega primero el checkpoint más reciente.
    for snapshot in reversed(snapshots):
        state_trace = snapshot.values.get("trace", [])
        if not state_trace:
            continue

        event = state_trace[-1]
        events.append({
            "step": snapshot.metadata.get("step"),
            "node": event.get("node"),
            "status": event.get("status"),
            "details": event,
            "next": list(snapshot.next),
        })

    return events

def run_agent(question: str) -> dict[str, Any]:
    run_id = str(uuid4())
    config = {"configurable": {"thread_id": run_id}}

    try:
        result = graph.invoke(
            {"question": question, "trace": []},
            config=config,
        )
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