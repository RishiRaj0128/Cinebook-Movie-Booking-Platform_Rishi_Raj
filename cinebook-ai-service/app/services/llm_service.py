import json
from typing import List, Dict, Any, Optional
from app.config import settings
from app.core.logging import logger
from app.agents.prompts import SYSTEM_AGENT_PROMPT

class LLMService:
    @staticmethod
    def call_llm(
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """
        Sends conversational messages and optional tool definitions to Groq LLM.
        Falls back to deterministic rule-based tool-selector if running without API key.
        """
        if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("mock"):
            logger.info("Using local deterministic tool-selection mock (no external Groq key configured).")
            return LLMService._mock_reasoning(messages)

        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)

            kwargs: Dict[str, Any] = {
                "model": settings.GROQ_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": settings.GROQ_MAX_TOKENS,
                "timeout": settings.GROQ_TIMEOUT_SECONDS,
            }
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            completion = client.chat.completions.create(**kwargs)
            choice = completion.choices[0].message

            tool_calls = []
            if choice.tool_calls:
                for tc in choice.tool_calls:
                    tool_calls.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    })

            return {
                "content": choice.content or "",
                "tool_calls": tool_calls,
                "finish_reason": completion.choices[0].finish_reason
            }
        except Exception as e:
            logger.error(f"Groq API completion failed: {str(e)}", exc_info=True)
            # Fall back to local tool selector rather than crashing the user request
            return LLMService._mock_reasoning(messages)

    @staticmethod
    def _mock_reasoning(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Deterministic reasoning fallback for unit tests and offline environments.
        Inspects last user message and selects appropriate tool or replies.
        """
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = str(m.get("content", "")).lower()
                break

        # Check if previous message already had tool output
        has_tool_results = any(m.get("role") == "tool" for m in messages)
        if has_tool_results:
            return {
                "content": "Based on our live catalog search, here are top matching titles that align with your preference. Let me know if you would like to inspect showtimes or check ticket pricing!",
                "tool_calls": [],
                "finish_reason": "stop"
            }

        # Intent-based mock tool selector
        if any(w in last_user_msg for w in ["search", "find", "sci-fi", "thriller", "action", "movie"]):
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "mock-tc-1",
                        "name": "search_movies",
                        "arguments": json.dumps({"query": last_user_msg, "limit": 3})
                    }
                ],
                "finish_reason": "tool_calls"
            }
        elif any(w in last_user_msg for w in ["recommend", "suggest", "popular"]):
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "mock-tc-2",
                        "name": "get_recommendations",
                        "arguments": json.dumps({"limit": 3})
                    }
                ],
                "finish_reason": "tool_calls"
            }
        elif any(w in last_user_msg for w in ["showtime", "theater", "screen", "time"]):
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "mock-tc-3",
                        "name": "get_showtimes",
                        "arguments": json.dumps({"movie_title": "Interstellar", "city": "Mumbai"})
                    }
                ],
                "finish_reason": "tool_calls"
            }
        elif any(w in last_user_msg for w in ["price", "cost", "quote", "ticket"]):
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "mock-tc-4",
                        "name": "calculate_booking_quote",
                        "arguments": json.dumps({"num_tickets": 2, "ticket_tier": "REGULAR"})
                    }
                ],
                "finish_reason": "tool_calls"
            }
        else:
            return {
                "content": "Welcome to CineBook! I am your AI movie concierge. I can search our catalog, check showtimes, curate personalized recommendations, and calculate ticket quotes. What would you like to watch today?",
                "tool_calls": [],
                "finish_reason": "stop"
            }
