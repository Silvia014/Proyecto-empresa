"""Qdrant retrieval and grounded answer generation for Brasaland."""

from __future__ import annotations

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


def query(question: str) -> str:
    """Public pipeline entry point: retrieval followed by model-generated answer only."""
    context = retrieve(question)
    return generate_answer(question, context)
