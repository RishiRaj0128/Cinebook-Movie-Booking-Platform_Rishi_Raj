#!/usr/bin/env bash
# ==============================================================================
# scripts/k8s-down.sh
# Teardown script for the local CineBook kind Kubernetes cluster.
#
# Prerequisite Tools:
#   - kind (Kubernetes in Docker CLI)
#
# Usage:
#   bash scripts/k8s-down.sh
# ==============================================================================
set -euo pipefail

CLUSTER_NAME="cinebook"

echo "=================================================================="
echo "          CineBook Kubernetes Cluster Teardown (kind)             "
echo "=================================================================="

# 1. Prerequisite verification
if ! command -v kind &>/dev/null; then
    echo "ERROR: 'kind' CLI is not installed or not in PATH." >&2
    exit 1
fi

# 2. Check if cluster exists
echo "[1/2] Checking if kind cluster '$CLUSTER_NAME' exists..."
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}\$"; then
    echo "Cluster '$CLUSTER_NAME' does not exist or has already been deleted."
    exit 0
fi

# 3. Teardown cluster
echo "[2/2] Deleting kind cluster '$CLUSTER_NAME'..."
kind delete cluster --name "$CLUSTER_NAME"

echo "=================================================================="
echo "  Kind cluster '$CLUSTER_NAME' has been cleanly deleted.          "
echo "  All associated containers, networks, and node state are purged. "
echo "=================================================================="
