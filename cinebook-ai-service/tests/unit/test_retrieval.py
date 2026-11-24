import uuid
from app.services.retrieval_service import RetrievalService

def test_reciprocal_rank_fusion_combines_and_boosts_intersecting_items():
    id1 = uuid.uuid4()
    id2 = uuid.uuid4()
    id3 = uuid.uuid4()

    vector_list = [
        {"id": id1, "title": "Inception", "score": 0.95},
        {"id": id2, "title": "Interstellar", "score": 0.88},
    ]
    fts_list = [
        {"id": id2, "title": "Interstellar", "score": 0.90},
        {"id": id3, "title": "Tenet", "score": 0.70},
    ]

    fused = RetrievalService.reciprocal_rank_fusion(
        vector_rankings=vector_list,
        fts_rankings=fts_list,
        k=60,
        vector_weight=0.7,
        fts_weight=0.3
    )

    assert len(fused) == 3
    # id2 appears in both lists, so its RRF score receives contributions from both ranks
    top_item = fused[0]
    assert top_item["id"] == id2
    assert top_item["vector_rank"] == 2
    assert top_item["fts_rank"] == 1

def test_semantic_search_endpoint_returns_valid_structure(client):
    response = client.post(
        "/api/v1/search/semantic",
        json={"query": "time travel thrillers", "limit": 5, "hybrid": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "time travel thrillers"
    assert "total_found" in data
    assert "results" in data
    assert "execution_time_ms" in data
    assert isinstance(data["results"], list)
