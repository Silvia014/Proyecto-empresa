import json
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from data.pipelines import rag
from data.process import rag as ingestion
from data.process.rag import _markdown_chunks
from services.api.app.rag import routes as rag_routes


def test_markdown_chunks_keep_heading_as_section():
    chunks = _markdown_chunks("# Policy\n\nKeep food covered.\n\n## Delivery\n\nCheck the seal.")

    assert chunks == [
        ("Policy", "Keep food covered."),
        ("Delivery", "Check the seal."),
    ]


def test_retrieve_discards_results_below_min_score(monkeypatch):
    points = [
        SimpleNamespace(payload={"text": "relevant", "company": "brasaland"}, score=0.8),
        SimpleNamespace(payload={"text": "weak", "company": "brasaland"}, score=0.2),
    ]

    class FakeQdrant:
        def __init__(self, **kwargs):
            pass

        def query_points(self, **kwargs):
            assert kwargs["limit"] == 5
            return SimpleNamespace(points=points)

    monkeypatch.setattr(rag, "QdrantClient", FakeQdrant)
    monkeypatch.setattr(rag, "embed", lambda text: [0.1, 0.2])

    results = rag.retrieve("How do we handle deliveries?", min_score=0.5)

    assert len(results) == 1
    assert results[0]["text"] == "relevant"
    assert results[0]["score"] == 0.8


def test_query_returns_generated_answer_not_retrieved_chunk(monkeypatch):
    retrieved = [{"text": "private source chunk", "source_document": "policy.md"}]
    monkeypatch.setattr(rag, "retrieve", lambda question: retrieved)
    monkeypatch.setattr(rag, "generate_answer", lambda question, context: "Model-generated answer.")

    answer = rag.query("What is the policy?")

    assert answer == "Model-generated answer."
    assert answer != retrieved[0]["text"]


def test_generate_answer_calls_generation_model_with_retrieved_context(monkeypatch):
    monkeypatch.setenv("RAG_GENERATION_MODEL", "student-chat-model")
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="Follow the documented policy."))]
            )

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    answer = rag.generate_answer(
        "What should staff do?",
        [{"source_document": "policy.md", "section": "Allergens", "language": "en", "text": "Escalate allergy reports."}],
        client=fake_client,
    )

    assert answer == "Follow the documented policy."
    assert captured["model"] == "student-chat-model"
    assert "Escalate allergy reports." in captured["messages"][1]["content"]
    assert "do not invent company facts" in captured["messages"][0]["content"]


def test_setup_replaces_company_chunks_deterministically(tmp_path, monkeypatch):
    document = tmp_path / "brasaland-policy.en.md"
    document.write_text("# Policy\n\nKeep the kitchen clean.", encoding="utf-8")
    monkeypatch.setattr(ingestion, "embed", lambda text: [0.1, 0.2])

    class FakeQdrant:
        def __init__(self):
            self.points = {}
            self.collection_created = False

        def collection_exists(self, name):
            return self.collection_created

        def create_collection(self, **kwargs):
            self.collection_created = True

        def get_collection(self, name):
            from qdrant_client import models

            vectors = models.VectorParams(size=2, distance=models.Distance.COSINE)
            return SimpleNamespace(config=SimpleNamespace(params=SimpleNamespace(vectors=vectors)))

        def delete(self, **kwargs):
            self.points.clear()

        def upsert(self, **kwargs):
            self.points.update({str(point.id): point for point in kwargs["points"]})

    qdrant = FakeQdrant()
    first_count = ingestion.setup(tmp_path, client=qdrant)
    first_ids = set(qdrant.points)
    second_count = ingestion.setup(tmp_path, client=qdrant)

    assert first_count == second_count == 1
    assert set(qdrant.points) == first_ids
    assert next(iter(qdrant.points.values())).payload["company"] == "brasaland"


def test_prepare_chunks_sets_required_metadata(tmp_path):
    (tmp_path / "policy.es.md").write_text("# Política\n\nTexto de la política.", encoding="utf-8")

    chunks = ingestion.prepare_chunks(tmp_path)

    assert len(chunks) == 1
    assert chunks[0] == {
        "source_document": "policy.es.md",
        "section": "Política",
        "company": "brasaland",
        "language": "es",
        "chunk_index": 0,
        "text": "Texto de la política.",
    }


def test_retrieval_evaluation_covers_every_corpus_document():
    root = Path(__file__).resolve().parents[2]
    cases = json.loads((root / "data/eval/rag-test-queries.json").read_text(encoding="utf-8"))
    source_files = {path.name for path in (root / "docs/company-knowledge-base").glob("*.md")}
    expected_files = {case["expected_source_document"] for case in cases}

    assert len(cases) >= 8
    assert expected_files == source_files


def test_http_endpoint_exposes_only_the_answer(monkeypatch):
    monkeypatch.setattr(rag_routes, "query", lambda question: "Generated response.")
    app = FastAPI()
    app.include_router(rag_routes.router)

    response = TestClient(app).post("/knowledge/query", json={"question": "What is the policy?"})

    assert response.status_code == 200
    assert response.json() == {"answer": "Generated response."}


def test_http_endpoint_reports_missing_model_configuration(monkeypatch):
    def missing_model(question):
        raise RuntimeError("Set RAG_GENERATION_MODEL to the 4Geeks generation model ID.")

    monkeypatch.setattr(rag_routes, "query", missing_model)
    app = FastAPI()
    app.include_router(rag_routes.router)

    response = TestClient(app).post("/knowledge/query", json={"question": "What is the policy?"})

    assert response.status_code == 503
    assert response.json()["detail"].startswith("Set RAG_GENERATION_MODEL")
