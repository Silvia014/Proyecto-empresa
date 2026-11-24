"""Markdown ingestion and Qdrant indexing for the Brasaland knowledge base."""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient, models

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")
COMPANY = "brasaland"
COLLECTION = os.getenv("RAG_COLLECTION", "brasaland_knowledge")
DEFAULT_CORPUS = ROOT / "docs" / "company-knowledge-base"
DEFAULT_BASE_URL = "https://llm.4geeks.ai"
DEFAULT_EMBEDDING_MODEL = "madrid-spain/openrouter/perplexity/pplx-embed-v1-0.6b"
DEFAULT_GENERATION_MODEL = "madrid-spain/openrouter/deepseek/deepseek-v4-flash"


def _client() -> OpenAI:
    """Create an OpenAI-compatible client using the student's configured gateway."""
    api_key = (
        os.getenv("LLM_API_KEY")
        or os.getenv("FOURGEEKS_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    if not api_key:
        raise RuntimeError("Set LLM_API_KEY to the API key provided for this project.")

    base_url = (
        os.getenv("LLM_BASE_URL")
        or os.getenv("FOURGEEKS_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
        or DEFAULT_BASE_URL
    )
    kwargs = {"api_key": api_key, "timeout": 60.0, "max_retries": 2}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


def _model_id(kind: str) -> str:
    names = {
        "embedding": ("RAG_EMBEDDING_MODEL", "EMBEDDING_MODEL"),
        "generation": ("RAG_GENERATION_MODEL", "GENERATION_MODEL"),
    }[kind]
    defaults = {
        "embedding": DEFAULT_EMBEDDING_MODEL,
        "generation": DEFAULT_GENERATION_MODEL,
    }
    value = next((os.getenv(name) for name in names if os.getenv(name)), defaults[kind])
    return value


def embed(text: str) -> list[float]:
    """Embed one text using the dedicated embedding model, never the chat model."""
    if not text.strip():
        raise ValueError("Cannot embed empty text.")
    response = _client().embeddings.create(model=_model_id("embedding"), input=text)
    return response.data[0].embedding


def _split_long_block(block: str, max_chars: int) -> list[str]:
    """Split oversized prose at sentence boundaries where possible."""
    if len(block) <= max_chars:
        return [block]
    sentences = re.split(r"(?<=[.!?])\s+", block)
    pieces: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_chars:
            if current:
                pieces.append(current)
                current = ""
            pieces.extend(
                sentence[i : i + max_chars].strip()
                for i in range(0, len(sentence), max_chars)
            )
        elif current and len(current) + len(sentence) + 1 > max_chars:
            pieces.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        pieces.append(current)
    return pieces


def _markdown_chunks(text: str, max_chars: int = 2400) -> list[tuple[str, str]]:
    """Chunk by Markdown heading and paragraph/list blocks, preserving section context."""
    section = "General"
    blocks: list[tuple[str, str]] = []
    current: list[str] = []

    def flush() -> None:
        nonlocal current
        content = "\n".join(current).strip()
        if content:
            blocks.append((section, content))
        current = []

    for line in text.splitlines():
        heading = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if heading:
            flush()
            section = heading.group(2).strip()
        elif line.strip():
            current.append(line.rstrip())
        else:
            flush()
    flush()

    chunks: list[tuple[str, str]] = []
    current_section = ""
    current_text = ""
    for block_section, block in blocks:
        for piece in _split_long_block(block, max_chars):
            combined = f"{current_text}\n\n{piece}".strip()
            if current_text and (block_section != current_section or len(combined) > max_chars):
                chunks.append((current_section, current_text))
                current_text = piece
                current_section = block_section
            else:
                current_text = combined
                current_section = block_section
    if current_text:
        chunks.append((current_section, current_text))
    return chunks


def prepare_chunks(corpus_dir: str | Path = DEFAULT_CORPUS) -> list[dict]:
    """Read source Markdown and return self-contained chunks with required metadata."""
    corpus = Path(corpus_dir)
    files = sorted(corpus.glob("*.md"))
    if not files:
        raise FileNotFoundError(f"No Markdown source documents found in {corpus}.")

    chunks: list[dict] = []
    for path in files:
        language = "es" if path.stem.endswith(".es") else "en"
        for index, (section, body) in enumerate(_markdown_chunks(path.read_text(encoding="utf-8"))):
            chunks.append({
                "source_document": path.name,
                "section": section,
                "company": COMPANY,
                "language": language,
                "chunk_index": index,
                "text": body,
            })
    if not chunks:
        raise ValueError(f"No indexable text found in {corpus}.")
    return chunks


def setup(
    corpus_dir: str | Path = DEFAULT_CORPUS,
    *,
    client: QdrantClient | None = None,
) -> int:
    """Index the Markdown corpus; deterministic IDs plus company-scoped reload make reruns safe."""
    chunks = prepare_chunks(corpus_dir)

    vectors = [embed(item["text"]) for item in chunks]
    qdrant = client or QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
    if not qdrant.collection_exists(COLLECTION):
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(size=len(vectors[0]), distance=models.Distance.COSINE),
        )
    else:
        info = qdrant.get_collection(COLLECTION)
        configured = info.config.params.vectors
        size = configured.size if isinstance(configured, models.VectorParams) else None
        if size is not None and size != len(vectors[0]):
            raise ValueError(
                f"Embedding dimension changed ({size} -> {len(vectors[0])}); "
                "use a new collection or recreate the old one before indexing."
            )

    qdrant.delete(
        collection_name=COLLECTION,
        points_selector=models.FilterSelector(
            filter=models.Filter(must=[models.FieldCondition(key="company", match=models.MatchValue(value=COMPANY))])
        ),
        wait=True,
    )
    qdrant.upsert(
        collection_name=COLLECTION,
        points=[
            models.PointStruct(
                id=str(uuid5(NAMESPACE_URL, f"{COMPANY}:{item['source_document']}:{item['chunk_index']}")),
                vector=vector,
                payload=item,
            )
            for item, vector in zip(chunks, vectors, strict=True)
        ],
        wait=True,
    )
    return len(chunks)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare or index the Brasaland RAG corpus.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect chunk counts and sizes without calling the embeddings API or writing to Qdrant.",
    )
    args = parser.parse_args()
    if args.dry_run:
        prepared = prepare_chunks()
        for source in sorted({item["source_document"] for item in prepared}):
            source_chunks = [item for item in prepared if item["source_document"] == source]
            lengths = [len(item["text"]) for item in source_chunks]
            print(f"{source}: {len(source_chunks)} chunks; max {max(lengths)} characters")
        print(f"Dry run complete: {len(prepared)} chunks; no model or Qdrant calls made.")
    else:
        print(f"Indexed {setup()} Brasaland knowledge chunks into {COLLECTION}.")
