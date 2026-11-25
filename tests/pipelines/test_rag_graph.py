from pathlib import Path

from services.api.app.rag import graph as rag_graph


ROOT = Path(__file__).resolve().parents[2]


def test_agent_eval_known_allergen_answer_is_anchored_to_brasaland_doc(monkeypatch):
    source_name = "brasaland-menu-allergens.en.md"
    source_text = (
        ROOT / "docs" / "company-knowledge-base" / source_name
    ).read_text(encoding="utf-8")

    def fake_retrieve(question):
        assert "sirloin" in question.lower()
        return [{
            "source_document": source_name,
            "section": "Main dishes",
            "language": "en",
            "text": source_text,
        }]

    def grounded_generation(question, context):
        retrieved_text = " ".join(context[0]["text"].split())
        assert "Marinade contains soy." in retrieved_text
        return "The Grilled Sirloin marinade contains soy."

    monkeypatch.setattr(rag_graph, "retrieve", fake_retrieve)
    monkeypatch.setattr(rag_graph, "generate_answer", grounded_generation)

    result = rag_graph.run_agent("Does the Grilled Sirloin marinade contain soy?")

    assert result["status"] == "success"
    assert "contains soy" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "retrieve_context",
        "generate_with_context",
    ]
    assert result["trace"][1]["details"]["sources"] == [source_name]


def test_agent_eval_empty_retrieval_takes_honest_no_context_branch(monkeypatch):
    monkeypatch.setattr(rag_graph, "retrieve", lambda question: [])

    def honest_generation(question, context):
        assert context == []
        return "The knowledge base does not contain enough information."

    monkeypatch.setattr(rag_graph, "generate_answer", honest_generation)

    result = rag_graph.run_agent("What is Brasaland's policy on lunar hotels?")

    assert result["status"] == "success"
    assert "does not contain enough information" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "retrieve_context",
        "answer_without_context",
    ]


def test_agent_eval_empty_question_ends_at_validation(monkeypatch):
    def retrieval_must_not_run(question):
        raise AssertionError("Retrieval ran for an invalid question.")

    def generation_must_not_run(question, context):
        raise AssertionError("Generation ran for an invalid question.")

    monkeypatch.setattr(rag_graph, "retrieve", retrieval_must_not_run)
    monkeypatch.setattr(rag_graph, "generate_answer", generation_must_not_run)

    result = rag_graph.run_agent("   ")

    assert result["status"] == "invalid"
    assert result["error"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
    ]