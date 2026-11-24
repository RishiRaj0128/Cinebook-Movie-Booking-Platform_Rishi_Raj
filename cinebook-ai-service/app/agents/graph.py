import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.agents.state import AgentState
from app.agents.nodes import (
    understand_intent_node,
    agent_reasoning_node,
    execute_tools_node,
    generate_final_response_node
)
from app.core.logging import logger

MAX_ITERATIONS = 4

class CineBookAgent:
    """
    Controlled LangGraph state machine orchestrating intent understanding,
    tool selection, tool execution, and response synthesis.
    """
    @classmethod
    def run(
        cls,
        user_message: str,
        db: Session,
        user_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes the agentic workflow loop with strict cycle safeguards.
        """
        history = chat_history or []
        state: AgentState = {
            "messages": [*history, {"role": "user", "content": user_message}],
            "user_id": user_id,
            "session_id": session_id,
            "intent": None,
            "query": user_message,
            "tool_calls": [],
            "recommended_movies": [],
            "iteration_count": 0,
            "final_response": None
        }

        # Step 1: Understand Intent
        intent_update = understand_intent_node(state)
        state.update(intent_update)

        # Step 2: Agentic Tool Reasoning Loop (Max 4 iterations to prevent runaway loops)
        executed_tool_telemetry = []

        while state["iteration_count"] < MAX_ITERATIONS:
            # Node: Agent Reasoning (Groq LLM call)
            reasoning_update = agent_reasoning_node(state)
            state["iteration_count"] = reasoning_update["iteration_count"]
            state["tool_calls"] = reasoning_update.get("tool_calls", [])

            if reasoning_update.get("final_response"):
                state["final_response"] = reasoning_update["final_response"]
                break

            # If no tools requested, break
            if not state["tool_calls"]:
                break

            # Node: Execute Allowlisted Tools
            tools_update = execute_tools_node(state, db=db)
            state["messages"].extend(tools_update.get("messages", []))
            state["tool_calls"] = []
            if tools_update.get("recommended_movies"):
                state["recommended_movies"].extend(tools_update["recommended_movies"])

            for msg in tools_update.get("messages", []):
                executed_tool_telemetry.append({
                    "tool_name": msg.get("name"),
                    "status": "SUCCESS"
                })

        # Step 3: Concluding Synthesis
        if not state.get("final_response"):
            final_update = generate_final_response_node(state)
            state["final_response"] = final_update["final_response"]

        return {
            "response": state["final_response"],
            "tool_calls": executed_tool_telemetry,
            "recommended_movies": state["recommended_movies"],
            "intent": state["intent"]
        }
