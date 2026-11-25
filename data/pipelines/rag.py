"""Qdrant retrieval and grounded answer generation for Brasaland."""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient

from data.process.rag import COLLECTION, _client, _model_id, embed

load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")


def retrieve(query: str, *, k: int = 5, min_score: float | None = None) -> list[dict]:
    """Return only payload dictionaries whose cosine similarity clears the threshold."""
    if not query.strip():
        raise ValueError("Question cannot be empty.")
    if k < 1:
        raise ValueError("k must be at least 1.")
    if min_score is None:
        min_score = float(os.getenv("RAG_MIN_SCORE", "0.45"))
    qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
    response = qdrant.query_points(
        collection_name=COLLECTION,
        query=embed(query),
        limit=k,
        with_payload=True,
    )
    return [
        {**(point.payload or {}), "score": float(point.score)}
        for point in response.points
        if point.payload and point.score >= min_score
    ]


def generate_answer(question: str, context: list[dict], *, client: OpenAI | None = None) -> str:
    """Generate an executive-facing answer using retrieved documents only."""
    context_text = "\n\n".join(
        f"[Source: {item.get('source_document', 'unknown')} | section: {item.get('section', 'unknown')} | "
        f"language: {item.get('language', 'unknown')}]\n{item.get('text', '')}"
        for item in context
        if item.get("text")
    )
    system_prompt = (
        "You are Brasaland's concise executive knowledge assistant for CEO Mariana Restrepo. "
        "Answer in the language used by the question. Be direct, decision-oriented, and warm. "
        "Use only the supplied retrieved context; do not invent company facts, numbers, policies, "
        "or recommendations that the context does not support. If the context is empty or does not "
        "answer the question, say clearly that the knowledge base does not contain enough information. "
        "Cite supporting source document names in your answer when useful."
    )
    user_prompt = (
        f"Retrieved context:\n{context_text or '[No relevant context passed the retrieval threshold.]'}"
        f"\n\nQuestion:\n{question}"
    )
    response = (client or _client()).chat.completions.create(
        model=_model_id("generation"),
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        temperature=0.2,
    )
    answer = response.choices[0].message.content
    if not answer or not answer.strip():
        raise RuntimeError("The generation model returned an empty answer.")
    return answer.strip()


def classify_agent_question(question: str, *, client: OpenAI | None = None) -> dict:
    """Choose static RAG knowledge, live incidents, inventory, or both."""
    system_prompt = (
        "Route the user's request to the correct Brasaland information source. "
        "Use route='incident' for current incident/ticket status, ticket details, or live incident lists; "
        "route='inventory' for current stock levels of a named product; "
        "route='rag' for stable company policies, procedures, products, and general knowledge; "
        "route='both' only when the user needs one live tool result and stable policy/context together. "
        "For route='both', set tool='incident' or tool='inventory' to identify the live source. "
        "Extract ticket_id when a numeric incident ID is stated. Extract inventory product_name as the "
        "short product name to search, and location_id only when explicitly stated. Extract only incident "
        "filters explicitly supported by the question. Never answer the question. Return one JSON object with "
        "keys route, tool, ticket_id, status, origin, category, branch, product_name, location_id. "
        "Use null for unknown fields. "
        "Allowed status: open, in_progress, resolved, discarded. Allowed origin: customer, branch, internal. "
        "Allowed category: equipment_failure, supply_issue, customer_complaint, staff_issue, "
        "facility_issue, pos_system, delivery_issue, other."
    )
    response = (client or _client()).chat.completions.create(
        model=_model_id("generation"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("The routing model returned an empty decision.")
    decision = json.loads(content)
    if not isinstance(decision, dict) or decision.get("route") not in {"rag", "incident", "inventory", "both"}:
        raise ValueError("The routing model returned an invalid source decision.")
    return decision


def generate_answer_with_live_sources(
    question: str,
    context: list[dict],
    live_results: dict[str, dict],
    *,
    client: OpenAI | None = None,
) -> str:
    """Generate an answer grounded in retrieved documents and/or live incident data."""
    document_context = "\n\n".join(
        f"[Document: {item.get('source_document', 'unknown')} | section: {item.get('section', 'unknown')} ]\n"
        f"{item.get('text', '')}"
        for item in context
        if item.get("text")
    ) or "[No relevant knowledge-base documents were retrieved.]"
    live_json = json.dumps(live_results, ensure_ascii=False, default=str)
    system_prompt = (
        "You are Brasaland's concise support knowledge assistant. Answer in the language used by the question. "
        "Use only the supplied company-document context and live operational-service results. Never infer or invent "
        "ticket IDs, statuses, stock counts, dates, or company policies. Treat live incident data as the source "
        "of truth for current tickets and live inventory data as the source of truth for stock. If any live result "
        "has status timeout, unavailable, forbidden, or invalid_response, explicitly say you could not confirm that "
        "live information right now; do not guess. If it is needs_filter, ask for a ticket ID or a named product. "
        "If it is not_found, say no matching record/product was found. If a request needs both sources, answer only "
        "the part supported by each source and clearly state any unavailable part. If a live result says "
        "truncated=true, state that the list is partial and ask for a narrower filter. "
        "Be direct and concise."
    )
    user_prompt = (
        f"Question:\n{question}\n\n"
        f"Retrieved company documents:\n{document_context}\n\n"
        f"Live operational service results:\n{live_json}"
    )
    response = (client or _client()).chat.completions.create(
        model=_model_id("generation"),
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        temperature=0.2,
    )
    answer = response.choices[0].message.content
    if not answer or not answer.strip():
        raise RuntimeError("The generation model returned an empty answer.")
    return answer.strip()


def query(question: str) -> str:
    """Public pipeline entry point: retrieval followed by model-generated answer only."""
    context = retrieve(question)
    return generate_answer(question, context)
