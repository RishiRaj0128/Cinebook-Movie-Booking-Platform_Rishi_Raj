from app.services.embedding_service import EmbeddingService

def test_prepare_movie_text_formats_consistently():
    text = EmbeddingService.prepare_movie_text(
        title="Inception",
        genre="Sci-Fi, Action",
        description="A thief who steals corporate secrets through dream-sharing technology.",
        language="English",
        rating=8.8
    )
    assert "Title: Inception" in text
    assert "Genre: Sci-Fi, Action" in text
    assert "Language: English" in text
    assert "Rating: 8.8/10" in text
    assert "Overview: A thief who steals corporate secrets" in text

def test_compute_source_hash_is_deterministic():
    text1 = "Title: Interstellar. Genre: Sci-Fi."
    text2 = "Title: Interstellar. Genre: Sci-Fi."
    text3 = "Title: Interstellar. Genre: Drama."

    hash1 = EmbeddingService.compute_source_hash(text1)
    hash2 = EmbeddingService.compute_source_hash(text2)
    hash3 = EmbeddingService.compute_source_hash(text3)

    assert hash1 == hash2
    assert hash1 != hash3
    assert len(hash1) == 64  # SHA-256 length

def test_embed_text_returns_384_dimensions():
    text = "Find thrilling psychological sci-fi movies"
    vec = EmbeddingService.embed_text(text)
    assert len(vec) == 384
    assert isinstance(vec[0], float)

def test_embed_batch_returns_correct_count_and_dimensions():
    texts = [
        "Romantic comedy set in Paris",
        "Action adventure with superhero stunts",
        "Historical period drama"
    ]
    vectors = EmbeddingService.embed_batch(texts)
    assert len(vectors) == 3
    for v in vectors:
        assert len(v) == 384
