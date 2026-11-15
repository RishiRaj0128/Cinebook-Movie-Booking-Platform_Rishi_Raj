#!/usr/bin/env bash
# ==============================================================================
# scripts/k8s-up.sh
# Automates the creation and bootstrapping of a local CineBook kind cluster.
#
# Prerequisite Tools:
#   - docker (Docker Engine / Docker Desktop)
#   - kind   (Kubernetes in Docker CLI)
#   - kubectl (Kubernetes CLI)
#
# Usage:
#   bash scripts/k8s-up.sh
# ==============================================================================
set -euo pipefail

CLUSTER_NAME="cinebook"
KIND_CONFIG="deploy/kind-config.yaml"
IMAGE_NAME="cinebook-backend:latest"

echo "=================================================================="
echo "          CineBook Kubernetes Cluster Bootstrap (kind)            "
echo "=================================================================="

# 1. Prerequisite verification
echo "[1/6] Checking required CLI tools..."
for tool in docker kind kubectl; do
    if ! command -v "$tool" &>/dev/null; then
        echo "ERROR: Required tool '$tool' is not installed or not in PATH." >&2
        echo "Please install '$tool' before running this script." >&2
        exit 1
    fi
    echo "  - $tool: FOUND ($(command -v "$tool"))"
done

# Check Docker daemon availability
if ! docker info &>/dev/null; then
    echo "ERROR: Docker daemon is not running. Please start Docker Desktop or the dockerd daemon." >&2
    exit 1
fi

# 2. Kind Cluster Provisioning
echo "[2/6] Checking for kind cluster '$CLUSTER_NAME'..."
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}\$"; then
    echo "  - Cluster '$CLUSTER_NAME' is already running."
else
    echo "  - Creating kind cluster '$CLUSTER_NAME' using $KIND_CONFIG..."
    kind create cluster --name "$CLUSTER_NAME" --config "$KIND_CONFIG"
fi

# 3. Build Backend Container Image Locally
echo "[3/6] Building backend container image locally ($IMAGE_NAME)..."
docker build -t "$IMAGE_NAME" ./cinebook-backend

# 4. Load Image into Kind Nodes
# Why local load? Loading directly into kind nodes bypasses private GHCR image
# pull authentication secrets, enabling 100% offline, zero-credential local runs.
echo "[4/6] Sideloading image '$IMAGE_NAME' into kind cluster '$CLUSTER_NAME'..."
kind load docker-image "$IMAGE_NAME" --name "$CLUSTER_NAME"

# 5. Apply Kubernetes Manifests in Order
echo "[5/6] Applying Kubernetes manifests..."
echo "  - Applying Namespace..."
kubectl apply -f deploy/k8s/namespace.yaml

echo "  - Applying Deployment (replicas: 2, profile: local)..."
kubectl apply -f deploy/k8s/deployment.yaml

echo "  - Applying NodePort Service (hostPort: 30080 -> containerPort: 8080)..."
kubectl apply -f deploy/k8s/service.yaml

echo "  - Applying HorizontalPodAutoscaler (CPU 70%, 2-4 replicas)..."
kubectl apply -f deploy/k8s/hpa.yaml

# 6. Wait for Deployment Rollout
echo "[6/6] Waiting for Deployment rollout to complete (timeout: 120s)..."
kubectl rollout status deployment/cinebook-backend -n cinebook --timeout=120s

echo "=================================================================="
echo "   CineBook Backend is successfully running on local Kubernetes!  "
echo "=================================================================="
echo "Active Pods:"
kubectl get pods -n cinebook -o wide
echo ""
echo "Service Endpoint:"
kubectl get svc -n cinebook
echo ""
echo "Verify cluster health with curl:"
echo "  curl -s http://localhost:30080/actuator/health"
echo "  curl -s http://localhost:30080/actuator/health/liveness"
echo "  curl -s http://localhost:30080/actuator/health/readiness"
echo "=================================================================="
