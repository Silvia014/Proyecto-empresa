# Brasaland RAG and LangGraph design

## Purpose and audience

The knowledge assistant serves CEO Mariana Restrepo with concise, decision-oriented answers based only on Brasaland's approved policy, product, and operating-procedure documents. It replies in the language of the question. It is not a source of live sales, staff, inventory, reservation, or customer data; those belong to operational APIs and dashboards.

## End-to-end flow

```text
Approved Markdown files
  -> setup(): parse headings and semantic blocks
  -> embed(chunk): dedicated embeddings model
  -> Qdrant collection `brasaland_knowledge` (cosine vectors + source metadata)

POST /agent/query
  -> validate_question
  -> retrieve_context: embed question -> Qdrant top-k -> min-score filter
  -> conditional edge:
       context found    -> generate_with_context -> END
       no context found -> answer_without_context -> END
  -> model-generated answer + run_id + graph trace

GET /agent/traces/{run_id}
  -> read the persisted LangGraph checkpoints for that run
```

The graph is compiled at module import time by `build_graph()` before the API serves requests. The endpoint delegates to `run_agent()` and does not contain retrieval or prompt-generation logic. The graph reuses `retrieve()` and `generate_answer()` from `data/pipelines/rag.py`; it does not duplicate the RAG implementation.

## Graph state, nodes, and routing

`AgentState` is a `TypedDict` containing only the current question, retrieved context, answer, error, and trace entries. It does not carry a conversation history. A new UUID `run_id` is used as the LangGraph `thread_id` for each invocation.

| Node | Responsibility |
| --- | --- |
| `validate_question` | Reject a blank question with a clear validation error; otherwise retain the trimmed question. |
| `retrieve_context` | Call the existing `retrieve()` function and append safe trace metadata: number of chunks and source names. |
| `generate_with_context` | Generate the final answer with the retrieved chunks as the only factual context. |
| `answer_without_context` | Call the same generator with empty context so the model responds honestly that the knowledge base lacks enough information. |

Edges are explicit: `START -> validate_question`; validation routes either to `retrieve_context` or `END`; retrieval routes either to `generate_with_context` or `answer_without_context`; both answer nodes end the run. Thus empty input does not trigger retrieval, and a below-threshold/empty retrieval does not force irrelevant chunks into the prompt.

## Indexing, corpus, and metadata

The source corpus lives in `docs/company-knowledge-base/`. `data/process/rag.py` reads supported Markdown documents, retains heading names as section metadata, and keeps paragraphs and list blocks together when possible. It groups blocks up to roughly 2,400 characters and splits oversized blocks at sentence boundaries when possible, preserving policy conditions and related procedure steps.

Each Qdrant payload records `source_document`, `section`, `company`, `language`, `chunk_index`, and `text`. Language is inferred from `.en.md` and `.es.md` filenames. Point IDs are deterministic UUIDv5 values. `setup()` replaces only points for `company=brasaland` before upserting the current corpus, so repeated indexing is idempotent and does not remove other companies' points.

Useful indexing commands:

```bash
uv run python -m data.process.rag --dry-run
uv run python -m data.process.rag
```

The dry run reports chunk counts and sizes without calling the embeddings service or changing Qdrant.

## Embeddings, generation, and retrieval settings

Embeddings and answer generation use separate model IDs and separate API operations:

- Embeddings: `madrid-spain/openrouter/perplexity/pplx-embed-v1-0.6b`, used by `embed()` at indexing and query time.
- Generation: `madrid-spain/openrouter/deepseek/deepseek-v4-flash`, used only by `generate_answer()`.
- Both use the OpenAI-compatible 4Geeks gateway configured by `LLM_API_KEY` and `LLM_BASE_URL` (`https://llm.4geeks.ai`).

Qdrant uses cosine similarity. The vector dimension is taken from the embedding response when the collection is created. Retrieval requests at most five nearest chunks and removes any below `RAG_MIN_SCORE` (default `0.45`); `top-k` is a maximum, not a guarantee. Only surviving payload dictionaries are passed to answer generation.

The prompt identifies the audience and tone, requires the model to answer in the question's language, prohibits unsupported company facts, and tells it to say when the supplied context is insufficient. The API response exposes the generated answer and trace metadata, never raw Qdrant SDK results or similarity scores.

The development evaluation in `data/eval/` contains eight bilingual questions covering the indexed source documents. At the recorded threshold, the expected source/section appears in the top three for all eight questions (Recall@3 8/8, 100%). This is a small milestone evaluation, not a production quality guarantee; add representative questions and expected source chunks before relying on it operationally.

## API and trace inspection

- `POST /agent/query` accepts `{"question": "..."}` and returns `run_id`, `status`, `answer`, `error`, and `trace`. Invalid input returns HTTP 400; a graph/model failure returns HTTP 502 with a safe error message.
- `GET /agent/traces/{run_id}` returns the saved trace for a valid run ID, or HTTP 404 when no checkpoint exists.
- Trace entries identify executed nodes and their outcomes. Retrieval traces include chunk count and source document names, not full chunk text or similarity scores.

The ERP uses its same-origin `/api/knowledge/query` route as a server-side proxy to `RAG_API_URL/agent/query`. This keeps the browser from calling `localhost` or requiring cross-origin CORS access. Production must set `RAG_API_URL` to the deployed FastAPI base URL.

## Checkpointing and local development

The graph uses LangGraph's SQLite `SqliteSaver` checkpoint backend. By default, checkpoints are stored at `data/eval/rag-checkpoints.sqlite`; `RAG_CHECKPOINT_DB` can override the path. The database file contains run state, including questions and generated answers, and should remain local/ignored rather than being committed. Checkpoints let the trace endpoint inspect completed runs after invocation.

The SQLite file is a local/development checkpoint store. Before running multiple API replicas or deploying a horizontally scaled service, use a shared production-grade checkpointer and configure retention/access controls appropriate for the sensitivity of user questions. Qdrant is started locally with Docker Compose and is available to the API container at `http://qdrant:6333`; local host processes use `http://localhost:6333`.

## Configuration

Keep credentials in the ignored root `.env.local`; never commit real API keys. `.env.example` contains names and non-secret defaults:

```dotenv
LLM_API_KEY=
LLM_BASE_URL=https://llm.4geeks.ai
RAG_EMBEDDING_MODEL=madrid-spain/openrouter/perplexity/pplx-embed-v1-0.6b
RAG_GENERATION_MODEL=madrid-spain/openrouter/deepseek/deepseek-v4-flash
RAG_MIN_SCORE=0.45
QDRANT_URL=http://localhost:6333
RAG_COLLECTION=brasaland_knowledge
RAG_CHECKPOINT_DB=data/eval/rag-checkpoints.sqlite
```

Inside Docker Compose, set `QDRANT_URL=http://qdrant:6333` for the API service.

## Tests and evaluation

Run the RAG and graph tests from the repository root:

```bash
uv run pytest tests/pipelines/test_rag.py tests/pipelines/test_rag_graph.py -q
```

Graph tests should use mocked retrieval and generation boundaries, verify conditional routing (valid/invalid question and context/no-context), and check a grounded answer against the expected real source content. The offline Recall@3 evaluation is run with:

```bash
uv run python -m data.eval.evaluate_rag
```

## Guardrails and known limitations

- The final answer always comes from the generation model; raw vector-search results are never returned as the answer.
- Retrieval thresholds prevent forcing low-similarity material into the prompt, but the threshold and eight-question evaluation need broader validation.
- Answers are limited to the indexed documents and cannot provide live business metrics.
- SQLite checkpointing is intended for local development/single-instance use, not shared multi-replica production deployments.
