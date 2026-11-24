# CineBook — Enterprise AWS Production Deployment Guide

This document defines the production cloud architecture, infrastructure provisioning, and deployment strategy for the CineBook Movie Booking and Agentic AI Platform on Amazon Web Services (AWS).

---

## 1. Production Architecture Overview

CineBook implements a dual-backend enterprise topology:

```
                                  [ Internet / Users ]
                                           │
                                  [ AWS Route 53 DNS ]
                                           │
                           [ AWS CloudFront CDN (Frontend) ]
                                           │
                         [ AWS Application Load Balancer (ALB) ]
                                  │                 │
                ┌─────────────────┴─┐             ┌─┴────────────────┐
                │  /api/*, /actuator│             │  /api/v1/search  │
                │                   │             │  /api/v1/chat    │
                ▼                   ▼             ▼                  ▼
     [ CineBook Spring Boot ]               [ CineBook Python AI ]
       (Transactional Engine)                 (Agentic / Vector RAG)
                │                                    │
                │   ┌────────────────────────────┐   │
                └───►   Amazon Aurora PostgreSQL ◄───┘
                    │   v16 with pgvector (384d) │
                    └────────────────────────────┘
                                  │
                    ┌────────────────────────────┐
                    │ Amazon ElastiCache (Redis) │
                    │ (Pessimistic Seat Locks)   │
                    └────────────────────────────┘
```

### Responsibility Matrix

| Component | Technology | Hosting Tier | Scaling Model |
|---|---|---|---|
| **Frontend SPA** | React 18, TypeScript, Vite | AWS S3 + CloudFront | Global edge distribution |
| **Transactional Backend** | Java 21, Spring Boot 3.3.5 | AWS ECS Fargate or EKS | Target tracking (CPU > 70%) |
| **Agentic AI Microservice** | Python 3.12, FastAPI, LangGraph | AWS ECS Fargate or EKS | Target tracking (CPU > 60%, Latency < 400ms) |
| **Database** | PostgreSQL 16 + pgvector | Amazon Aurora Serverless v2 | 0.5 to 16 ACUs |
| **Cache & Locks** | Redis 7.2 | Amazon ElastiCache | Primary + Read Replica |
| **Model Inference** | Groq Llama 3.3 70B / Mixtral | External Groq API via HTTPS | Elastic serverless LLM |
| **Telemetry** | Prometheus + Grafana | AWS Managed Prometheus / CloudWatch | Managed |

---

## 2. Container Orchestration: ECS Fargate vs EKS

### Recommended Choice: AWS ECS Fargate
For this workload, **AWS ECS with AWS Fargate** is the recommended deployment choice because:
- Zero cluster management overhead (no master node patching, no kubelet upgrades).
- Native integration with AWS Application Load Balancers, IAM Task Execution Roles, and AWS Secrets Manager.
- Microsecond startup times for task autoscaling.
- Isolation at the VM boundary for Python ML workers and Java Spring Boot tasks.

---

## 3. Database: Amazon Aurora PostgreSQL with pgvector

### Configuration
- **Engine**: Amazon Aurora PostgreSQL (Compatible with PostgreSQL 16.2+).
- **Extension**: `pgvector` enabled via standard DB cluster parameter group:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- **HNSW Index Parameters**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_movie_embeddings_hnsw 
  ON movie_embeddings USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);
  ```
- **Multi-AZ**: Multi-AZ cluster deployment with 1 Primary writer and 1 Read replica in `ap-south-1` (Mumbai).
- **Data Isolation**: 
  - Java Backend uses `cinebook_app` master credentials (full read/write).
  - Python AI Service uses `cinebook_ai` restricted role (SELECT on movies/shows/theaters, full access to `movie_embeddings`, `user_preferences`, `chat_sessions`, `agent_tool_calls`, `recommendation_events`).

---

## 4. Environment Secrets & Security Architecture

1. **AWS Secrets Manager**:
   - `arn:aws:secretsmanager:ap-south-1:xxx:secret:cinebook/production`:
     - `DATABASE_URL`: `postgresql+psycopg2://...`
     - `GROQ_API_KEY`: `gsk_...`
     - `AI_INTERNAL_API_KEY`: High-entropy 64-character secret
     - `JWT_SECRET`: High-entropy 256-bit secret
     - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`

2. **IAM Task Role Least-Privilege**:
   - ECS Task Execution Role grants `secretsmanager:GetSecretValue` only on the CineBook secret ARN.
   - Network Security Groups restrict PostgreSQL port 5432 and Redis port 6379 to accept traffic *only* from Backend and AI Service security groups.

---

## 5. Kubernetes (EKS) Production Deployment Procedure

If deploying to Amazon EKS or hybrid cloud Kubernetes:

1. **Create Namespace and Secrets**:
   ```bash
   kubectl create namespace cinebook
   kubectl create secret generic cinebook-secrets \
     --from-literal=groq-api-key="YOUR_GROQ_KEY" \
     --from-literal=ai-internal-api-key="GENERATE_HIGH_ENTROPY_KEY" \
     -n cinebook
   ```

2. **Apply Manifests in Sequence**:
   ```bash
   kubectl apply -f deploy/k8s/ai-service-configmap.yaml -n cinebook
   kubectl apply -f deploy/k8s/ai-service-deployment.yaml -n cinebook
   kubectl apply -f deploy/k8s/ai-service-service.yaml -n cinebook
   ```

3. **Verify Health and Zero-Downtime Rollout**:
   ```bash
   kubectl rollout status deployment/cinebook-ai-service -n cinebook
   kubectl get pods -n cinebook -l app=cinebook-ai-service
   ```

---

## 6. Monthly AWS Production Cost Estimation

Estimated monthly infrastructure cost for medium-scale enterprise production traffic (serving ~150,000 active users / 500,000 queries per month):

| AWS Service | Specification / Tier | Monthly Cost (USD) |
|---|---|---|
| **Aurora PostgreSQL Serverless v2** | 2-4 ACU (Multi-AZ HA with pgvector) | ~$140.00 |
| **ECS Fargate (Spring Boot)** | 2 tasks × (1 vCPU, 2 GB RAM) | ~$58.00 |
| **ECS Fargate (Python AI Service)** | 2 tasks × (0.5 vCPU, 1 GB RAM) | ~$29.00 |
| **Amazon ElastiCache Redis** | cache.t4g.small (1 primary, 1 replica) | ~$35.00 |
| **Application Load Balancer (ALB)** | 1 ALB + LCU usage | ~$22.00 |
| **CloudFront & S3 (Frontend)** | Global edge + 50 GB egress | ~$8.00 |
| **AWS Secrets Manager & KMS** | 3 secrets + KMS encryption calls | ~$3.00 |
| **Groq LLM API** | Llama 3.3 70B (~50M tokens/month) | ~$30.00 |
| **Total Estimated Monthly Cost** | | **~$325.00 / month** |
