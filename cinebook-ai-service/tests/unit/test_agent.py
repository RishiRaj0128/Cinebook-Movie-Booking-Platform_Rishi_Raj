import json
import uuid
from app.agents.tools import AgentTools, BookingQuoteArgs
from app.agents.graph import CineBookAgent
from app.database.connection import SessionLocal

def test_booking_quote_calculates_correct_pricing_and_gst():
    res = AgentTools.execute_tool(
        tool_name="calculate_booking_quote",
        arguments_json=json.dumps({"num_tickets": 2, "ticket_tier": "REGULAR"}),
        db=None
    )
    assert res["status"] == "SUCCESS"
    output = res["output"]
    assert output["unit_price_inr"] == 250
    assert output["subtotal_inr"] == 500
    assert output["convenience_fee_inr"] == 60
    assert output["gst_18_percent_inr"] == 101
    assert output["total_amount_inr"] == 661

def test_get_showtimes_returns_available_screen_slots():
    res = AgentTools.execute_tool(
        tool_name="get_showtimes",
        arguments_json=json.dumps({"movie_title": "Interstellar", "city": "Mumbai"}),
        db=None
    )
    assert res["status"] == "SUCCESS"
    output = res["output"]
    assert output["city"] == "Mumbai"
    assert len(output["available_slots"]) >= 1

def test_unapproved_tool_is_rejected():
    res = AgentTools.execute_tool(
        tool_name="execute_arbitrary_sql",
        arguments_json="{}",
        db=None
    )
    assert res["status"] == "REJECTED"
    assert "not in the approved allowlist" in res["output"]["error"]

def test_cinebook_agent_runs_discovery_workflow():
    db = SessionLocal()
    try:
        result = CineBookAgent.run(
            user_message="Recommend a great sci-fi thriller for tonight",
            db=db,
            user_id=uuid.uuid4(),
            session_id=uuid.uuid4()
        )
        assert "response" in result
        assert isinstance(result["response"], str)
        assert len(result["response"]) > 0
        assert "tool_calls" in result
    finally:
        db.close()
