# Brasaland knowledge assistant — RAG design

## Audience and purpose

The assistant supports CEO Mariana Restrepo with concise, decision-oriented answers grounded in Brasaland's approved knowledge documents. It answers in the language of the question. It is not a source of live sales, staff, inventory, or customer data; those require operational APIs and dashboards.

## Components and flow

```text
Markdown corpus
  -> data.process.rag.setup()
  -> heading/paragraph-aware chunks
  -> dedicated embedding model via embed()
  -> Qdrant collection brasaland_knowledge

POST /knowledge/query
  -> data.pipelines.rag.query()
  -> retrieve(): embed question, Qdrant top-k, minimum similarity filter
  -> generate_answer(): assemble grounded prompt and call separate chat model
  -> {"answer": "model-generated text"}
```

The HTTP route delegates to `query()` and never returns Qdrant points, payloads, or scores.

## Corpus and metadata

Source files live in `docs/company-knowledge-base/`. Each indexed payload contains `source_document`, `section`, `company`, `language`, `chunk_index`, and `text`. Language is inferred from `.en.md` / `.es.md` filenames.

## Chunking and idempotency

Markdown headings are retained as section metadata. Paragraphs and list blocks are kept together when possible and grouped up to roughly 2,400 characters; oversized blocks are split at sentence boundaries where possible. This keeps policy conditions close to the relevant section while bounding embedding input size.

`setup()` uses deterministic UUIDv5 point IDs and clears only the `company=brasaland` points before upserting the current corpus. Re-running the indexer therefore replaces Brasaland's index without duplicating points or deleting any other company's data.

Run `uv run python -m data.process.rag --dry-run` to inspect chunk counts and sizes without calling the LLM gateway or changing Qdrant. The current corpus produces eight chunks: one per bilingual source document.

## Models and vector settings

`RAG_EMBEDDING_MODEL` and `RAG_GENERATION_MODEL` are separate settings. The embedding model is used by `embed()` both at indexing and query time; the generation model is used only by `generate_answer()`. Both use the OpenAI-compatible 4Geeks LLM gateway through `LLM_API_KEY` and `LLM_BASE_URL`. The verified gateway host is `https://llm.4geeks.ai`. The selected embedding model is `madrid-spain/openrouter/perplexity/pplx-embed-v1-0.6b`; the generation model is `madrid-spain/openrouter/deepseek/deepseek-v4-flash` (the `litellm/` prefix from the catalog is omitted as directed).

Qdrant uses cosine distance. Collection vector size is inferred from the first embedding during setup. Retrieval uses top-k 5 with configurable `RAG_MIN_SCORE=0.45`. On the current eight-query development evaluation, this threshold retrieved the expected document and section in the top three for all eight queries (100% Recall@3). The sample is small and should be expanded before treating the threshold as production-validated.

## Runtime and configuration

Locally, Qdrant is exposed only on loopback at `localhost:6333`; the Docker API reaches it at `http://qdrant:6333`. The API image sets `PYTHONPATH=/app:/app/services/api` so root and API package imports resolve inside the container. Keep actual credentials in the ignored root `.env.local`; `.env.example` contains names only. The Next.js UI is available at `/knowledge` and uses `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

Required model variables:

```dotenv
LLM_API_KEY=
LLM_BASE_URL=https://llm.4geeks.ai
RAG_EMBEDDING_MODEL=madrid-spain/openrouter/perplexity/pplx-embed-v1-0.6b
RAG_GENERATION_MODEL=madrid-spain/openrouter/deepseek/deepseek-v4-flash
RAG_MIN_SCORE=0.45
QDRANT_URL=http://localhost:6333
RAG_COLLECTION=brasaland_knowledge
```

## Guardrails and limitations

- The generation prompt permits answers only from retrieved context and requires an honest no-information response when retrieval is empty.
- Low-scoring chunks are filtered before prompt assembly; top-k is a maximum, not a promise to return k results.
- The current threshold met the 80% milestone target on the eight-query evaluation; expand the evaluation set before production.
- This assistant answers policy/procedure questions from the indexed files. It must not claim access to live restaurant telemetry or customer records.
