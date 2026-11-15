#!/usr/bin/env bash
# ==============================================================================
# scripts/collect-evidence.sh
# Automated verification test harness for CineBook Kubernetes deployment.
# Executes end-to-end tests against the kind cluster and records REAL command
# output into docs/evidence/ as numbered text logs.
#
# Usage (run in Git Bash or WSL on Windows):
#   bash scripts/collect-evidence.sh
# ==============================================================================
set -euo pipefail

EVIDENCE_DIR="docs/evidence"
NAMESPACE="cinebook"
DEPLOYMENT="cinebook-backend"
HEALTH_URL="http://localhost:30080/actuator/health"

mkdir -p "$EVIDENCE_DIR"

echo "=================================================================="
echo "          CineBook Automated SRE Evidence Collector               "
echo "=================================================================="
START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Execution Started (UTC): $START_UTC"

# ------------------------------------------------------------------------------
# 1. Cluster Bootstrap & Rollout Timing
# ------------------------------------------------------------------------------
echo "[1/5] Bootstrapping kind cluster and measuring deployment rollout..."
FILE_01="$EVIDENCE_DIR/01-k8s-up.txt"
{
    echo "=================================================================="
    echo "CineBook kind Cluster Bootstrap Log"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
} > "$FILE_01"

START_BOOTSTRAP=$(date +%s)
# Run k8s-up.sh and tee output to file 01
if bash scripts/k8s-up.sh 2>&1 | tee -a "$FILE_01"; then
    END_BOOTSTRAP=$(date +%s)
    BOOTSTRAP_DURATION=$((END_BOOTSTRAP - START_BOOTSTRAP))
    echo -e "\nBootstrap completed successfully in ${BOOTSTRAP_DURATION}s." >> "$FILE_01"
else
    END_BOOTSTRAP=$(date +%s)
    BOOTSTRAP_DURATION=$((END_BOOTSTRAP - START_BOOTSTRAP))
    echo -e "\nBootstrap FAILED after ${BOOTSTRAP_DURATION}s." >> "$FILE_01"
    echo "ERROR: k8s-up.sh failed. See $FILE_01 for details." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# 2. Pod Inventory, Deployment Spec & Health Verification
# ------------------------------------------------------------------------------
echo "[2/5] Inspecting active Pods, Deployment details, and Actuator health..."
FILE_02="$EVIDENCE_DIR/02-pods-and-health.txt"
{
    echo "=================================================================="
    echo "CineBook Pods and Health Verification"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
    echo ""
    echo "--- 1. Pod Inventory (get pods -o wide) ---"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo ""
    echo "--- 2. Deployment Specification & Replicas ---"
    kubectl describe deployment "$DEPLOYMENT" -n "$NAMESPACE"
    echo ""
    echo "--- 3. Actuator Health Endpoint HTTP Response (Port 30080) ---"
    echo "GET $HEALTH_URL"
    curl -sS -i "$HEALTH_URL" || echo "ERROR: Failed to connect to $HEALTH_URL"
    echo ""
    echo "--- 4. Actuator Liveness Endpoint HTTP Response ---"
    curl -sS -i "http://localhost:30080/actuator/health/liveness" || echo "ERROR: Failed to reach liveness endpoint"
    echo ""
    echo "--- 5. Actuator Readiness Endpoint HTTP Response ---"
    curl -sS -i "http://localhost:30080/actuator/health/readiness" || echo "ERROR: Failed to reach readiness endpoint"
} > "$FILE_02"
echo "  -> Saved to $FILE_02"

# ------------------------------------------------------------------------------
# 3. Self-Healing Test: Pod Termination & Recovery Time Measurement
# ------------------------------------------------------------------------------
echo "[3/5] Executing self-healing experiment (pod kill & recovery timing)..."
FILE_03="$EVIDENCE_DIR/03-self-healing.txt"
POD_TO_KILL=$(kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}')
{
    echo "=================================================================="
    echo "CineBook Self-Healing Drill: Targeted Pod Deletion"
    echo "Target Pod: $POD_TO_KILL"
    echo "Started (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
    echo "Deleting pod '$POD_TO_KILL'..."
} > "$FILE_03"

KILL_START=$(date +%s)
kubectl delete pod "$POD_TO_KILL" -n "$NAMESPACE" >> "$FILE_03"

# Poll until deployment readyReplicas equals desired replicas (2)
TIMEOUT_SECS=90
ELAPSED=0
RECOVERED=false

while [ "$ELAPSED" -lt "$TIMEOUT_SECS" ]; do
    READY_REPLICAS=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    if [ "$READY_REPLICAS" == "2" ]; then
        KILL_END=$(date +%s)
        RECOVERY_SECS=$((KILL_END - KILL_START))
        RECOVERED=true
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

{
    echo ""
    if [ "$RECOVERED" = true ]; then
        echo "RESULT: PASS"
        echo "Measured Recovery Duration: ${RECOVERY_SECS} seconds"
        echo "All 2/2 replicas returned to Ready state automatically."
    else
        echo "RESULT: FAILED (Timed out after ${TIMEOUT_SECS}s waiting for 2/2 Ready replicas)"
    fi
    echo ""
    echo "Post-Recovery Pod Status:"
    kubectl get pods -n "$NAMESPACE" -o wide
} >> "$FILE_03"
echo "  -> Saved to $FILE_03"

# ------------------------------------------------------------------------------
# 4. Zero-Downtime Rolling Restart Under Active HTTP Traffic
# ------------------------------------------------------------------------------
echo "[4/5] Executing rolling restart with continuous HTTP probing..."
FILE_04="$EVIDENCE_DIR/04-rolling-restart.txt"
PROBE_LOG=$(mktemp)
TRAFFIC_STOP_FLAG=$(mktemp)
rm -f "$TRAFFIC_STOP_FLAG"

# Launch background curl loop
(
    while [ ! -f "$TRAFFIC_STOP_FLAG" ]; do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$HEALTH_URL" 2>/dev/null || echo "000")
        echo "$(date +%s.%N) $CODE" >> "$PROBE_LOG"
        sleep 0.2
    done
) &
PROBER_PID=$!

ROLLOUT_START=$(date +%s)
kubectl rollout restart deployment/"$DEPLOYMENT" -n "$NAMESPACE"
kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=120s
ROLLOUT_END=$(date +%s)

# Stop traffic prober
touch "$TRAFFIC_STOP_FLAG"
wait "$PROBER_PID" 2>/dev/null || true
rm -f "$TRAFFIC_STOP_FLAG"

TOTAL_PROBES=$(wc -l < "$PROBE_LOG" | tr -d ' ')
SUCCESS_PROBES=$(grep -c " 200$" "$PROBE_LOG" || true)
FAILED_PROBES=$(grep -v -c " 200$" "$PROBE_LOG" || true)
ROLLOUT_SECS=$((ROLLOUT_END - ROLLOUT_START))

{
    echo "=================================================================="
    echo "CineBook Rolling Restart (Zero-Downtime Verification)"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Rollout Duration: ${ROLLOUT_SECS} seconds"
    echo "=================================================================="
    echo "Total Probes Executed:   $TOTAL_PROBES"
    echo "Successful Probes (200): $SUCCESS_PROBES"
    echo "Failed Probes (non-200): $FAILED_PROBES"
    if [ "$FAILED_PROBES" -eq 0 ]; then
        echo "RESULT: PASS (Zero dropped requests during rolling restart)"
    else
        echo "RESULT: DEGRADED ($FAILED_PROBES requests failed during rollout)"
    fi
    echo ""
    echo "Final Pod Replicas:"
    kubectl get pods -n "$NAMESPACE" -o wide
} > "$FILE_04"
rm -f "$PROBE_LOG"
echo "  -> Saved to $FILE_04"

# ------------------------------------------------------------------------------
# 5. HPA Status and Cluster Events
# ------------------------------------------------------------------------------
echo "[5/5] Recording HPA metrics and Kubernetes events..."
FILE_05="$EVIDENCE_DIR/05-hpa-and-events.txt"
{
    echo "=================================================================="
    echo "CineBook HPA Status & Cluster Events"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
    echo ""
    echo "--- 1. HorizontalPodAutoscaler Status ---"
    if kubectl get hpa -n "$NAMESPACE" 2>/dev/null; then
        kubectl describe hpa cinebook-backend-hpa -n "$NAMESPACE"
    else
        echo "HPA check failed or metrics-server not installed in this cluster."
        echo "To install metrics-server on kind with insecure TLS:"
        echo "  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
        echo "  kubectl patch -n kube-system deployment/metrics-server --type='json' -p='[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/args/-\",\"value\":\"--kubelet-insecure-tls\"}]'"
    fi
    echo ""
    echo "--- 2. Recent Kubernetes Namespace Events ---"
    kubectl get events -n "$NAMESPACE" --sort-by='.metadata.creationTimestamp'
} > "$FILE_05"
echo "  -> Saved to $FILE_05"

echo "=================================================================="
echo "Evidence collection complete! Output files generated:"
ls -lh "$EVIDENCE_DIR"
echo "=================================================================="
