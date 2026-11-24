import os
import hashlib
from typing import List, Optional
import numpy as np
from app.config import settings
from app.core.logging import logger

_model_instance = None

def get_embedding_model():
    """
    Lazy singleton loader for SentenceTransformer embedding model.
    Loads 'BAAI/bge-small-en-v1.5' (384 dimensions).
    Uses deterministic MockEmbeddingModel when USE_MOCK_EMBEDDINGS=true or during tests.
    """
    global _model_instance
    if _model_instance is None:
        use_mock = (
            os.environ.get("USE_MOCK_EMBEDDINGS", "false").lower() == "true"
            or settings.ENVIRONMENT == "testing"
        )
        if use_mock:
            logger.info("Using deterministic MockEmbeddingModel for testing environment.")
            _model_instance = MockEmbeddingModel(dimension=settings.EMBEDDING_DIMENSION)
            return _model_instance

        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL_NAME}...")
            _model_instance = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            logger.info("Embedding model loaded successfully.")
        except Exception as e:
            logger.warning(
                f"SentenceTransformer load failed ({str(e)}). Falling back to mock embedder."
            )
            _model_instance = MockEmbeddingModel(dimension=settings.EMBEDDING_DIMENSION)
    return _model_instance

class MockEmbeddingModel:
    """
    Deterministic mock embedder used during offline unit testing or CI environments
    where HuggingFace downloads are unavailable. Produces normalized 384-dim vectors.
    """
    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def encode(self, texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True):
        is_single = isinstance(texts, str)
        text_list = [texts] if is_single else texts

        embeddings = []
        for text in text_list:
            # Seed random generator with SHA-256 of text to produce deterministic vectors
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
            rng = np.random.RandomState(seed)
            vec = rng.randn(self.dimension).astype(np.float32)
            if normalize_embeddings:
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
            embeddings.append(vec)

        return embeddings[0] if is_single else np.array(embeddings)

class EmbeddingService:
    @staticmethod
    def compute_source_hash(text: str) -> str:
        """
        Computes SHA-256 digest of normalized movie text representation.
        Used to detect metadata changes and bypass redundant embedding generation.
        """
        return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()

    @staticmethod
    def prepare_movie_text(
        title: str,
        genre: str,
        description: Optional[str] = None,
        language: str = "English",
        rating: Optional[float] = None
    ) -> str:
        """
        Constructs rich, structured semantic representation of movie metadata.
        Follows BGE recommendation format for dense retrieval.
        """
        parts = [
            f"Title: {title.strip()}",
            f"Genre: {genre.strip()}",
            f"Language: {language.strip()}"
        ]
        if rating is not None:
            parts.append(f"Rating: {rating}/10")
        if description and description.strip():
            # Truncate overlong descriptions to prevent truncation artifacts
            clean_desc = " ".join(description.split())[:1000]
            parts.append(f"Overview: {clean_desc}")

        return ". ".join(parts)

    @classmethod
    def embed_text(cls, text: str) -> List[float]:
        """
        Generates 384-dimensional normalized vector for a single query or document.
        """
        model = get_embedding_model()
        vector = model.encode(text, normalize_embeddings=True)
        if hasattr(vector, "tolist"):
            return vector.tolist()
        return list(vector)

    @classmethod
    def embed_batch(cls, texts: List[str]) -> List[List[float]]:
        """
        Batch encodes text representations.
        """
        if not texts:
            return []
        model = get_embedding_model()
        vectors = model.encode(
            texts,
            batch_size=settings.EMBEDDING_BATCH_SIZE,
            normalize_embeddings=True
        )
        if hasattr(vectors, "tolist"):
            return vectors.tolist()
        return [v.tolist() if hasattr(v, "tolist") else list(v) for v in vectors]
