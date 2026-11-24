import uuid
from typing import List, Dict, Any, Optional, Annotated
from typing_extensions import TypedDict
import operator

class AgentState(TypedDict):
    """
    State passed between nodes in the LangGraph agentic reasoning loop.
    """
    messages: Annotated[List[Dict[str, Any]], operator.add]
    user_id: Optional[uuid.UUID]
    session_id: Optional[uuid.UUID]
    intent: Optional[str]
    query: str
    tool_calls: List[Dict[str, Any]]
    recommended_movies: List[Dict[str, Any]]
    iteration_count: int
    final_response: Optional[str]
