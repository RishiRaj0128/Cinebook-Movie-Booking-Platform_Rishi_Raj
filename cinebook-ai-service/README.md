# CineBook AI Microservice

Dedicated Python FastAPI microservice providing Agentic AI discovery, semantic search, hybrid retrieval, and personalized movie recommendations for the CineBook platform.

## Architecture

```
React Frontend (Vite)
       │
       ▼
Java Spring Boot (Port 8080) ──── (REST API) ────► CineBook AI Service (FastAPI / Port 8000)
(Transactional: Auth, Bookings,                         (LLM Agent, Embeddings,
 Payments, Ledger, Seat Locks)                           Semantic Search, pgvector)
       │                                                         │
       └─────────────────── PostgreSQL 16 ───────────────────────┘
                               (pgvector)
```

## Features

- **FastAPI Framework:** High-performance, asynchronous REST API with OpenAPI documentation.
- **pgvector Integration:** 384-dimensional dense vector embeddings generated via `BAAI/bge-small-en-v1.5`.
- **Hybrid Search:** Combines vector similarity with PostgreSQL full-text search (BM25) using Reciprocal Rank Fusion.
- **LangGraph Agent:** Stateful graph-based reasoning loop with validated tool calling.
- **User Memory & Context:** Persistent user preferences and conversation memory with strict database-level ownership isolation.
- **Least-Privilege Security:** Separate database role (`cinebook_ai`) restricted from mutating financial ledger and booking tables.

## Quickstart

### Prerequisites
- Python 3.12+
- PostgreSQL 16 with `pgvector`

### Local Development

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cinebook
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   AI_INTERNAL_API_KEY=cinebook-internal-secret
   ```

4. Run development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. Explore the interactive API docs at `http://localhost:8000/docs`.

### Running Tests

```bash
pytest tests/
```
