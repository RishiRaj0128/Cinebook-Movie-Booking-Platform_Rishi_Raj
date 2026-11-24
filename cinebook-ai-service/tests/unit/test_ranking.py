import uuid
from app.services.recommendation_service import RecommendationService
from app.database.models import Movie

def test_calculate_movie_score_boosts_matching_genre():
    movie = Movie(
        id=uuid.uuid4(),
        title="Dune: Part Two",
        genre="Sci-Fi, Adventure",
        language="English",
        rating=8.6
    )

    preferred_genres = {"sci-fi", "action"}
    preferred_languages = {"english"}

    matching_score = RecommendationService.calculate_movie_score(
        movie=movie,
        preferred_genres=preferred_genres,
        preferred_languages=preferred_languages,
        interacted_movie_ids=set()
    )

    non_matching_score = RecommendationService.calculate_movie_score(
        movie=movie,
        preferred_genres={"romance", "comedy"},
        preferred_languages=preferred_languages,
        interacted_movie_ids=set()
    )

    assert matching_score["total_score"] > non_matching_score["total_score"]
    assert matching_score["breakdown"]["genre"] > non_matching_score["breakdown"]["genre"]

def test_generate_explanation_synthesizes_transparent_reason():
    movie = Movie(
        id=uuid.uuid4(),
        title="Oppenheimer",
        genre="Drama, History",
        language="English",
        rating=8.9
    )

    score_details = {
        "total_score": 0.85,
        "breakdown": {
            "genre": 0.8,
            "quality": 0.89,
            "language": 1.0,
            "semantic": 0.7,
            "history": 0.8
        }
    }

    explanation = RecommendationService.generate_explanation(movie, score_details)
    assert "Recommended because" in explanation
    assert "Drama, History" in explanation
    assert "8.9/10" in explanation
