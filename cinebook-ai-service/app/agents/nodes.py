import json
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.agents.state import AgentState
from app.agents.prompts import SYSTEM_AGENT_PROMPT
from app.agents.tools import AgentTools
from app.services.llm_service import LLMService
from app.core.logging import logger

def understand_intent_node(state: AgentState) -> Dict[str, Any]:
    """
    Classifies the user's conversational intent to guide the agentic cycle.
    """
    query_lower = state["query"].lower()
    intent = "GENERAL"

    if any(k in query_lower for k in ["search", "find", "looking for", "about", "similar to"]):
        intent = "SEARCH"
    elif any(k in query_lower for k in ["recommend", "suggest", "what should i watch", "top movies"]):
        intent = "RECOMMENDATION"
    elif any(k in query_lower for k in ["showtime", "show", "timing", "theater", "theatre", "when"]):
        intent = "SHOWTIMES"
    elif any(k in query_lower for k in ["price", "cost", "ticket", "rate", "quote"]):
        intent = "BOOKING_QUOTE"

    return {"intent": intent, "iteration_count": 0}

def agent_reasoning_node(state: AgentState) -> Dict[str, Any]:
    """
    Evaluates current conversation context and determines whether to invoke tools or finalize response.
    """
    messages = [
        {"role": "system", "content": SYSTEM_AGENT_PROMPT},
        *state["messages"]
    ]

    llm_output = LLMService.call_llm(
        messages=messages,
        tools=AgentTools.TOOL_DEFINITIONS
    )

    new_tool_calls = llm_output.get("tool_calls", [])
    response_content = llm_output.get("content", "")

    return {
        "tool_calls": new_tool_calls,
        "final_response": response_content if not new_tool_calls else None,
        "iteration_count": state["iteration_count"] + 1
    }

def execute_tools_node(state: AgentState, db: Session) -> Dict[str, Any]:
    """
    Executes selected tools safely through the AgentTools registry.
    Logs execution telemetry and returns tool results to the conversation.
    """
    executed_tools = []
    tool_messages = []
    recommended_movies = []

    for tc in state["tool_calls"]:
        t_name = tc["name"]
        t_args = tc["arguments"]

        exec_result = AgentTools.execute_tool(
            tool_name=t_name,
            arguments_json=t_args,
            db=db,
            user_id=state.get("user_id"),
            session_id=state.get("session_id")
        )

        executed_tools.append({
            "tool_name": t_name,
            "arguments": t_args if isinstance(t_args, dict) else json.loads(t_args) if isinstance(t_args, str) else {},
            "status": exec_result["status"],
            "duration_ms": exec_result["duration_ms"]
        })

        output_data = exec_result.get("output", {})
        tool_messages.append({
            "role": "tool",
            "name": t_name,
            "content": json.dumps(output_data)
        })

        # Capture rich movie card metadata for frontend rendering
        if t_name in ["search_movies", "get_recommendations"] and isinstance(output_data, list):
            for m in output_data:
                if isinstance(m, dict) and "title" in m:
                    recommended_movies.append(m)

    return {
        "messages": tool_messages,
        "tool_calls": [],
        "recommended_movies": recommended_movies
    }

def generate_final_response_node(state: AgentState) -> Dict[str, Any]:
    """
    Synthesizes the concluding assistant response if not already finalized.
    """
    if state.get("final_response"):
        return {"final_response": state["final_response"]}

    # Synthesize based on tool results
    messages = [
        {"role": "system", "content": SYSTEM_AGENT_PROMPT},
        *state["messages"]
    ]
    llm_output = LLMService.call_llm(messages=messages, tools=None)
    content = llm_output.get("content") or "Here are the best matching options from our catalog based on your request."
    return {"final_response": content}
