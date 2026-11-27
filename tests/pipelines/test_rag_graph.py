from pathlib import Path
from datetime import datetime, timezone

from services.api.app.rag import graph as rag_graph
from services.api.app.rag.tools import (
    IncidentLookupInput,
    IncidentLookupResult,
    IncidentRecord,
    InventoryLookupResult,
    InventoryStockRecord,
)


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
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: {"route": "rag"},
    )

    result = rag_graph.run_agent("Does the Grilled Sirloin marinade contain soy?")

    assert result["status"] == "success"
    assert "contains soy" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "classify_request",
        "retrieve_context",
        "generate_with_context",
    ]
    assert result["trace"][2]["details"]["sources"] == [source_name]


def test_agent_eval_empty_retrieval_takes_honest_no_context_branch(monkeypatch):
    monkeypatch.setattr(rag_graph, "retrieve", lambda question: [])
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: {"route": "rag"},
    )

    def honest_generation(question, context):
        assert context == []
        return "The knowledge base does not contain enough information."

    monkeypatch.setattr(rag_graph, "generate_answer", honest_generation)

    result = rag_graph.run_agent("What is Brasaland's policy on lunar hotels?")

    assert result["status"] == "success"
    assert "does not contain enough information" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "classify_request",
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
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: (_ for _ in ()).throw(AssertionError("Classification ran for an invalid question.")),
    )

    result = rag_graph.run_agent("   ")

    assert result["status"] == "invalid"
    assert result["error"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
    ]


def _sample_incident() -> IncidentRecord:
    now = datetime.now(timezone.utc)
    return IncidentRecord(
        id=482,
        title="POS terminal offline",
        description="The front counter terminal is offline.",
        status="in_progress",
        category="pos_system",
        origin="branch",
        branch="central",
        created_at=now,
        updated_at=now,
    )


def test_agent_eval_live_ticket_question_uses_incident_tool_not_rag(monkeypatch):
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: {"route": "incident", "ticket_id": 482},
    )

    def retrieval_must_not_run(question):
        raise AssertionError("RAG retrieval ran for a ticket-status question.")

    def incident_tool(request):
        assert request == IncidentLookupInput(ticket_id=482)
        return IncidentLookupResult(status="success", incidents=[_sample_incident()])

    def generated_from_live_data(question, context, live_results):
        assert context == []
        incident_result = live_results["incident_service"]
        assert incident_result["status"] == "success"
        assert incident_result["incidents"][0]["id"] == 482
        return "Ticket 482 is in progress."

    monkeypatch.setattr(rag_graph, "retrieve", retrieval_must_not_run)
    monkeypatch.setattr(rag_graph, "lookup_incidents", incident_tool)
    monkeypatch.setattr(rag_graph, "generate_answer_with_live_sources", generated_from_live_data)

    result = rag_graph.run_agent("What is the current status of ticket 482?")

    assert result["answer"] == "Ticket 482 is in progress."
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "classify_request",
        "lookup_incident",
        "generate_from_sources",
    ]
    assert result["trace"][2]["status"] == "success"


def test_agent_eval_incident_tool_timeout_uses_honest_fallback(monkeypatch):
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: {"route": "incident", "ticket_id": 482},
    )
    monkeypatch.setattr(
        rag_graph,
        "lookup_incidents",
        lambda request: IncidentLookupResult(status="timeout"),
    )

    def honest_fallback(question, context, live_results):
        incident_result = live_results["incident_service"]
        assert incident_result["status"] == "timeout"
        return "I could not confirm the live status of ticket 482 right now."

    monkeypatch.setattr(rag_graph, "generate_answer_with_live_sources", honest_fallback)
    result = rag_graph.run_agent("What is the current status of ticket 482?")

    assert "could not confirm" in result["answer"]
    assert [event["node"] for event in result["trace"]][-2:] == [
        "lookup_incident",
        "generate_from_sources",
    ]
    assert result["trace"][-2]["status"] == "timeout"


def test_agent_eval_combined_question_uses_rag_then_live_incident_tool(monkeypatch):
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: {"route": "both", "tool": "incident", "ticket_id": 482},
    )
    monkeypatch.setattr(
        rag_graph,
        "retrieve",
        lambda question: [{"source_document": "incident-policy.md", "text": "Policy context."}],
    )
    monkeypatch.setattr(
        rag_graph,
        "lookup_incidents",
        lambda request: IncidentLookupResult(status="success", incidents=[_sample_incident()]),
    )

    def combined_generation(question, context, live_results):
        incident_result = live_results["incident_service"]
        assert context[0]["text"] == "Policy context."
        assert incident_result["incidents"][0]["status"] == "in_progress"
        return "Ticket 482 is in progress; the policy context is available."

    monkeypatch.setattr(rag_graph, "generate_answer_with_live_sources", combined_generation)
    result = rag_graph.run_agent("What is ticket 482's status and what is the incident policy?")

    assert "in progress" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "classify_request",
        "retrieve_context",
        "lookup_incident",
        "generate_from_sources",
    ]


def test_agent_eval_inventory_question_uses_authorized_inventory_tool(monkeypatch):
    monkeypatch.setattr(
        rag_graph,
        "classify_agent_question",
        lambda question: {"route": "inventory", "product_name": "Sirloin"},
    )

    def retrieval_must_not_run(question):
        raise AssertionError("RAG retrieval ran for a current-stock question.")

    product = InventoryStockRecord(
        id=12,
        location_id="CO-MDE-01",
        name="Sirloin",
        category="meat",
        unit_of_measure="kg",
        current_stock=4.5,
        reorder_point=3,
        below_reorder=False,
    )

    def inventory_tool(request, *, actor_role):
        assert request.product_name == "Sirloin"
        assert actor_role == "chef"
        return InventoryLookupResult(status="success", products=[product])

    def inventory_answer(question, context, live_results):
        result = live_results["inventory_service"]
        assert result["products"][0]["current_stock"] == 4.5
        assert result["products"][0]["unit_of_measure"] == "kg"
        return "There are 4.5 kg of Sirloin in stock."

    monkeypatch.setattr(rag_graph, "retrieve", retrieval_must_not_run)
    monkeypatch.setattr(rag_graph, "lookup_inventory", inventory_tool)
    monkeypatch.setattr(rag_graph, "generate_answer_with_live_sources", inventory_answer)

    result = rag_graph.run_agent("How much Sirloin do we have in stock?", actor={"role": "chef"})

    assert result["answer"] == "There are 4.5 kg of Sirloin in stock."
    assert [event["node"] for event in result["trace"]] == [
        "validate_question",
        "classify_request",
        "lookup_inventory",
        "generate_from_sources",
    ]
    assert result["trace"][2]["status"] == "success"
