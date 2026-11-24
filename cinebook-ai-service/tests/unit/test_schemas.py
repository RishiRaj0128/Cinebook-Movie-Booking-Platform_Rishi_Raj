import uuid
import pytest
from pydantic import ValidationError
from app.schemas.search import SemanticSearchRequest, MovieSearchResult
from app.schemas.chat import ChatMessageRequest
from app.schemas.feedback import FeedbackSubmissionRequest

def test_valid_semantic_search_request():
    req = SemanticSearchRequest(query="Christopher Nolan mind-bending thrillers")
    assert req.query == "Christopher Nolan mind-bending thrillers"
    assert req.limit == 10
    assert req.hybrid is True

def test_empty_query_raises_validation_error():
    with pytest.raises(ValidationError):
        SemanticSearchRequest(query="")

def test_valid_chat_message_request():
    req = ChatMessageRequest(message="Recommend a movie for date night")
    assert req.message == "Recommend a movie for date night"
    assert req.session_id is None

def test_feedback_submission_request():
    movie_id = uuid.uuid4()
    req = FeedbackSubmissionRequest(
        movie_id=movie_id,
        feedback_type="THUMBS_UP",
        rating=5
    )
    assert req.movie_id == movie_id
    assert req.feedback_type == "THUMBS_UP"
    assert req.rating == 5
