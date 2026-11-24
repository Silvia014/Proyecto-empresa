# Brasaland RAG retrieval evaluation

**Run date:** 2026-11-24
**Embedding model:** `madrid-spain/openrouter/perplexity/pplx-embed-v1-0.6b`
**Generation model:** `madrid-spain/openrouter/deepseek/deepseek-v4-flash`
**Retrieval settings:** top-k 3, `RAG_MIN_SCORE=0.45`, Qdrant cosine similarity

## Result

| Metric | Result | Milestone target |
|---|---:|---:|
| Recall@3 | 8/8 (100%) | At least 80% |

All eight bilingual questions retrieved a chunk whose source document and section matched the expected answer area. The questions cover the loyalty program, menu allergens, supplier ordering, and waste protocol in English and Spanish.

## Integration smoke checks

- Indexed all eight chunks into the local Qdrant collection `brasaland_knowledge`.
- Called the RAG pipeline with a Spanish food-allergy question; the live generation model returned a Spanish answer grounded in the two menu-allergen documents.
- Sent `POST /knowledge/query` to the local FastAPI container; it returned HTTP 200 with only the model-generated `answer` field.
- Built the Next.js application successfully and fetched `/knowledge`; it returned HTTP 200 and included the query form.

## Interpretation

The current threshold meets the milestone target on this evaluation set. Eight queries are a small sample, so the result is evidence of project-level retrieval quality, not a production guarantee. The live UI button flow has not yet been manually exercised in a browser. Add more questions per document and include paraphrases and out-of-scope questions before production deployment.

Reproduce with:

```bash
uv run python -m data.process.rag
uv run python -m data.eval.evaluate_rag
```
