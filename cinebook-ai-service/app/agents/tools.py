import json
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.database.models import Movie, AgentToolCall, UserPreference
from app.services.retrieval_service import RetrievalService
from app.services.recommendation_service import RecommendationService

# --- Pydantic Tool Schemas ---
class SearchMoviesArgs(BaseModel):
    query: str = Field(..., description="Natural language search description (e.g., 'time travel sci-fi', 'family comedy')")
    genre: Optional[str] = Field(None, description="Optional genre filter")
    limit: int = Field(default=5, ge=1, le=10)

class MovieDetailsArgs(BaseModel):
    title_or_id: str = Field(..., description="Movie title or UUID to look up")

class RecommendationsArgs(BaseModel):
    limit: int = Field(default=5, ge=1, le=10)

class ShowtimesArgs(BaseModel):
    movie_title: Optional[str] = Field(None, description="Movie title to check showtimes for")
    city: Optional[str] = Field(default="Mumbai", description="City name (e.g. Mumbai, Delhi, Bengaluru)")

class BookingQuoteArgs(BaseModel):
    num_tickets: int = Field(default=2, ge=1, le=10, description="Number of tickets")
    ticket_tier: str = Field(default="REGULAR", description="REGULAR, PREMIUM, or RECLINER")

# --- Tool Execution Registry ---
class AgentTools:
    TOOL_DEFINITIONS = [
        {
            "type": "function",
            "function": {
                "name": "search_movies",
                "description": "Search the active CineBook catalog using hybrid semantic similarity and full-text keyword retrieval.",
                "parameters": SearchMoviesArgs.schema()
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_movie_details",
                "description": "Retrieve comprehensive metadata (synopsis, duration, rating, genre, language) for a specific movie title or ID.",
                "parameters": MovieDetailsArgs.schema()
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_recommendations",
                "description": "Curate personalized movie recommendations based on user genre affinities, viewing history, and high-rated catalog titles.",
                "parameters": RecommendationsArgs.schema()
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_showtimes",
                "description": "Look up scheduled theater showtimes, screen formats (IMAX, 4DX, Dolby), and cities.",
                "parameters": ShowtimesArgs.schema()
            }
        },
        {
            "type": "function",
            "function": {
                "name": "calculate_booking_quote",
                "description": "Calculate price quote, convenience fee, and GST for a cinema ticket purchase without booking seats.",
                "parameters": BookingQuoteArgs.schema()
            }
        }
    ]

    @classmethod
    def execute_tool(
        cls,
        tool_name: str,
        arguments_json: str,
        db: Session,
        user_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """
        Executes a validated allowlisted tool, tracks execution duration,
        and logs an audit record into agent_tool_calls.
        """
        start_time = time.time()
        status = "SUCCESS"
        error_msg = None
        result_data: Any = None

        try:
            raw_args = json.loads(arguments_json) if isinstance(arguments_json, str) else arguments_json
        except Exception:
            raw_args = {}

        try:
            if tool_name == "search_movies":
                args = SearchMoviesArgs(**raw_args)
                results = RetrievalService.search_hybrid(
                    db=db,
                    query=args.query,
                    genre=args.genre,
                    limit=args.limit
                )
                result_data = [
                    {
                        "id": str(r.id),
                        "title": r.title,
                        "genre": r.genre,
                        "language": r.language,
                        "rating": r.rating,
                        "similarity_score": r.similarity_score
                    }
                    for r in results
                ]

            elif tool_name == "get_movie_details":
                args = MovieDetailsArgs(**raw_args)
                target = args.title_or_id.strip()
                movie = db.query(Movie).filter(
                    (Movie.title.ilike(f"%{target}%")) |
                    (Movie.id == target if len(target) == 36 else False)
                ).first()
                if movie:
                    result_data = {
                        "id": str(movie.id),
                        "title": movie.title,
                        "genre": movie.genre,
                        "language": movie.language,
                        "duration_minutes": movie.duration_minutes,
                        "rating": float(movie.rating) if movie.rating else None,
                        "description": movie.description
                    }
                else:
                    result_data = {"error": f"Movie '{target}' not found in active catalog."}

            elif tool_name == "get_recommendations":
                args = RecommendationsArgs(**raw_args)
                response = RecommendationService.get_recommendations(
                    db=db,
                    user_id=user_id,
                    limit=args.limit
                )
                result_data = [
                    {
                        "movie_id": str(r.movie_id),
                        "title": r.title,
                        "genre": r.genre,
                        "rating": r.rating,
                        "reason": r.recommendation_reason
                    }
                    for r in response.recommendations
                ]

            elif tool_name == "get_showtimes":
                args = ShowtimesArgs(**raw_args)
                result_data = {
                    "city": args.city,
                    "movie": args.movie_title or "Featured Blockbusters",
                    "available_slots": [
                        {"theater": "PVR Inox Megaplex", "screen": "IMAX Laser", "time": "14:30", "price_inr": 450},
                        {"theater": "Cinepolis Grand Mall", "screen": "Screen 3", "time": "18:00", "price_inr": 320},
                        {"theater": "PVR Directors Cut", "screen": "Gold Class", "time": "21:15", "price_inr": 650}
                    ]
                }

            elif tool_name == "calculate_booking_quote":
                args = BookingQuoteArgs(**raw_args)
                base_prices = {"REGULAR": 250, "PREMIUM": 400, "RECLINER": 600}
                unit_price = base_prices.get(args.ticket_tier.upper(), 250)
                subtotal = unit_price * args.num_tickets
                convenience_fee = 30 * args.num_tickets
                gst = round((subtotal + convenience_fee) * 0.18)
                total = subtotal + convenience_fee + gst
                result_data = {
                    "tier": args.ticket_tier.upper(),
                    "num_tickets": args.num_tickets,
                    "unit_price_inr": unit_price,
                    "subtotal_inr": subtotal,
                    "convenience_fee_inr": convenience_fee,
                    "gst_18_percent_inr": gst,
                    "total_amount_inr": total,
                    "note": "Quote valid for 10 minutes. Select seats on seatmap to proceed."
                }
            else:
                status = "REJECTED"
                error_msg = f"Tool '{tool_name}' is not in the approved allowlist."
                result_data = {"error": error_msg}

        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            result_data = {"error": error_msg}
            logger.error(f"Error executing agent tool {tool_name}: {error_msg}", exc_info=True)

        duration_ms = int((time.time() - start_time) * 1000)

        # Audit log into agent_tool_calls (when database session is active)
        if db is not None:
            try:
                tool_call_record = AgentToolCall(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    session_id=session_id,
                    tool_name=tool_name,
                    sanitized_arguments=json.dumps(raw_args),
                    execution_status=status,
                    execution_duration_ms=duration_ms,
                    error_message=error_msg,
                    created_at=datetime.now(timezone.utc)
                )
                db.add(tool_call_record)
                db.commit()
            except Exception as log_err:
                logger.warning(f"Failed to record agent tool call audit: {str(log_err)}")
                db.rollback()

        return {
            "tool_name": tool_name,
            "status": status,
            "duration_ms": duration_ms,
            "output": result_data
        }
