from app.config import Settings

def test_default_settings():
    s = Settings(DATABASE_URL="postgresql://user:pass@localhost:5432/db")
    assert s.EMBEDDING_DIMENSION == 384
    assert s.EMBEDDING_MODEL_NAME == "BAAI/bge-small-en-v1.5"
    assert s.GROQ_MODEL == "llama-3.3-70b-versatile"
    assert s.PORT == 8000
