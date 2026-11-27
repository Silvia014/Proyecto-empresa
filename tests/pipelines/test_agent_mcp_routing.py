"""Offline evaluations for automatic RAG/MCP routing and safe fallbacks."""

from services.api.app.rag import graph as agent


def test_ticket_status_question_uses_mcp_and_generates_a_grounded_answer(monkeypatch):
    calls = []
    monkeypatch.setattr(agent, "_invoke_mcp_tool", lambda name, args: calls.append((name, args)) or {"id": 482, "status": "in_progress"})
    monkeypatch.setattr(agent, "generate_answer", lambda question, context: f"Ticket 482 is {context[-1]['text']}" )
    monkeypatch.setattr(agent, "retrieve", lambda question: (_ for _ in ()).throw(AssertionError("RAG should not be called for a live ticket lookup")))

    result = agent.run_agent("What is the status of ticket 482?")

    assert result["status"] == "success"
    assert calls == [("get_incident", {"incident_id": 482})]
    assert "in_progress" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question", "route_question", "mcp_tool", "generate_answer",
    ]
    assert result["trace"][1]["details"]["route"] == "mcp"
    assert result["trace"][2]["details"]["tool"] == "get_incident"


def test_policy_question_uses_rag_without_calling_mcp(monkeypatch):
    monkeypatch.setattr(agent, "_invoke_mcp_tool", lambda *_: (_ for _ in ()).throw(AssertionError("MCP should not run for policy")))
    monkeypatch.setattr(agent, "retrieve", lambda _: [{"source_document": "allergens.md", "section": "Allergens", "text": "Marinade contains soy."}])
    monkeypatch.setattr(agent, "generate_answer", lambda question, context: "The marinade contains soy." if "soy" in context[0]["text"] else "unsupported")

    result = agent.run_agent("What is the allergy policy for the marinade?")

    assert result["status"] == "success"
    assert result["answer"] == "The marinade contains soy."
    assert [event["node"] for event in result["trace"]] == [
        "validate_question", "route_question", "retrieve_context", "generate_answer",
    ]
    assert result["trace"][1]["details"]["route"] == "rag"


def test_mcp_failure_returns_honest_fallback_instead_of_inventing_status(monkeypatch):
    monkeypatch.setattr(agent, "_invoke_mcp_tool", lambda *_: (_ for _ in ()).throw(TimeoutError("offline")))
    monkeypatch.setattr(agent, "generate_answer", lambda *_: (_ for _ in ()).throw(AssertionError("Do not generate from absent live data")))

    result = agent.run_agent("What is the status of incident 23?")

    assert result["status"] == "success"
    assert "No pude confirmar" in result["answer"]
    assert [event["node"] for event in result["trace"]] == [
        "validate_question", "route_question", "mcp_tool", "fallback_response",
    ]
    assert result["trace"][2]["details"]["status"] == "fallback"


def test_inventory_question_is_routed_to_live_read_only_tool():
    decision = agent.route_question("¿Cuánto stock tenemos de arroz?")

    assert decision == {
        "route": "mcp",
        "tool_name": "list_inventory_products",
        "tool_args": {"query": "arroz"},
    }


def test_incident_status_updates_use_lifecycle_tool_not_generic_patch():
    decision = agent.route_question("Mark incident 31 resolved")

    assert decision["tool_name"] == "update_incident_status"
    assert decision["tool_args"] == {"incident_id": 31, "status": "resolved"}


def test_ambiguous_write_request_asks_for_required_fields():
    decision = agent.route_question("Please create a support ticket")

    assert decision["route"] == "clarify"
    assert "title" in decision["missing_fields"]


def test_create_incident_requires_and_routes_explicit_fields():
    decision = agent.route_question(
        "Create incident; title=POS offline; description=Terminal stopped responding; "
        "category=pos_system; origin=branch; branch=central"
    )

    assert decision["tool_name"] == "create_incident"
    assert decision["tool_args"] == {
        "title": "POS offline",
        "description": "Terminal stopped responding",
        "category": "pos_system",
        "origin": "branch",
        "branch": "central",
    }
