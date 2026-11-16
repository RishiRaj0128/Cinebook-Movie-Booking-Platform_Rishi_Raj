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
set -u
set -o pipefail

EVIDENCE_DIR="docs/evidence"
NAMESPACE="cinebook"
DEPLOYMENT="cinebook-backend"
HEALTH_URL="http://localhost:30080/actuator/health"
ROLLOUT_TIMEOUT_SECS=240
SELF_HEAL_TIMEOUT_SECS=120
PROBE_INTERVAL_SECS="0.2"
CONNECT_TIMEOUT_SECS="2"

mkdir -p "$EVIDENCE_DIR"

# Global state for cleanup trap
PROBER_PID=""
TRAFFIC_STOP_FLAG=""
PROBE_LOG=""

cleanup() {
    if [ -n "$PROBER_PID" ] && kill -0 "$PROBER_PID" 2>/dev/null; then
        kill "$PROBER_PID" 2>/dev/null || true
        wait "$PROBER_PID" 2>/dev/null || true
    fi
    if [ -n "$TRAFFIC_STOP_FLAG" ] && [ -f "$TRAFFIC_STOP_FLAG" ]; then
        rm -f "$TRAFFIC_STOP_FLAG"
    fi
    if [ -n "$PROBE_LOG" ] && [ -f "$PROBE_LOG" ]; then
        rm -f "$PROBE_LOG"
    fi
}
trap cleanup EXIT INT TERM

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
STAGE1_EXIT=0
bash scripts/k8s-up.sh 2>&1 | tee -a "$FILE_01" || STAGE1_EXIT=$?
END_BOOTSTRAP=$(date +%s)
BOOTSTRAP_DURATION=$((END_BOOTSTRAP - START_BOOTSTRAP))

{
    echo ""
    echo "Stage 1 Exit Code: $STAGE1_EXIT"
    if [ "$STAGE1_EXIT" -eq 0 ]; then
        echo "Bootstrap completed successfully in ${BOOTSTRAP_DURATION}s."
    else
        echo "Bootstrap FAILED (exit code: $STAGE1_EXIT) after ${BOOTSTRAP_DURATION}s."
    fi
} >> "$FILE_01"

# ------------------------------------------------------------------------------
# 2. Pod Inventory, Deployment Spec & Health Verification
# ------------------------------------------------------------------------------
echo "[2/5] Inspecting active Pods, Deployment details, and Actuator health..."
FILE_02="$EVIDENCE_DIR/02-pods-and-health.txt"
STAGE2_EXIT=0
{
    echo "=================================================================="
    echo "CineBook Pods and Health Verification"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
    echo ""
    echo "--- 1. Pod Inventory (get pods -o wide) ---"
    kubectl get pods -n "$NAMESPACE" -o wide || STAGE2_EXIT=$?
    echo ""
    echo "--- 2. Deployment Specification & Replicas ---"
    kubectl describe deployment "$DEPLOYMENT" -n "$NAMESPACE" || STAGE2_EXIT=$?
    echo ""
    echo "--- 3. Actuator Health Endpoint HTTP Response (Port 30080) ---"
    echo "GET $HEALTH_URL"
    curl -sS -i "$HEALTH_URL" || { echo "ERROR: Failed to connect to $HEALTH_URL"; STAGE2_EXIT=1; }
    echo ""
    echo "--- 4. Actuator Liveness Endpoint HTTP Response ---"
    curl -sS -i "http://localhost:30080/actuator/health/liveness" || { echo "ERROR: Failed to reach liveness endpoint"; STAGE2_EXIT=1; }
    echo ""
    echo "--- 5. Actuator Readiness Endpoint HTTP Response ---"
    curl -sS -i "http://localhost:30080/actuator/health/readiness" || { echo "ERROR: Failed to reach readiness endpoint"; STAGE2_EXIT=1; }
    echo ""
    echo "Stage 2 Exit Code: $STAGE2_EXIT"
} > "$FILE_02"
echo "  -> Saved to $FILE_02 (Exit Code: $STAGE2_EXIT)"

# ------------------------------------------------------------------------------
# 3. Self-Healing Test: Pod Termination & Recovery Time Measurement
# ------------------------------------------------------------------------------
echo "[3/5] Executing self-healing experiment (pod kill & recovery timing)..."
FILE_03="$EVIDENCE_DIR/03-self-healing.txt"
STAGE3_EXIT=0
POD_TO_KILL=$(kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

{
    echo "=================================================================="
    echo "CineBook Self-Healing Drill: Targeted Pod Deletion"
    echo "Target Pod: $POD_TO_KILL"
    echo "Started (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
} > "$FILE_03"

if [ -n "$POD_TO_KILL" ]; then
    echo "Deleting pod '$POD_TO_KILL'..." >> "$FILE_03"
    KILL_START=$(date +%s)
    kubectl delete pod "$POD_TO_KILL" -n "$NAMESPACE" >> "$FILE_03" || STAGE3_EXIT=$?

    ELAPSED=0
    RECOVERED=false
    while [ "$ELAPSED" -lt "$SELF_HEAL_TIMEOUT_SECS" ]; do
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
            echo "RESULT: FAILED (Timed out after ${SELF_HEAL_TIMEOUT_SECS}s waiting for 2/2 Ready replicas)"
            STAGE3_EXIT=1
        fi
        echo ""
        echo "Post-Recovery Pod Status:"
        kubectl get pods -n "$NAMESPACE" -o wide || true
        echo ""
        echo "Stage 3 Exit Code: $STAGE3_EXIT"
    } >> "$FILE_03"
else
    echo "ERROR: No pods found in deployment '$DEPLOYMENT' to terminate." >> "$FILE_03"
    STAGE3_EXIT=1
    echo "Stage 3 Exit Code: $STAGE3_EXIT" >> "$FILE_03"
fi
echo "  -> Saved to $FILE_03 (Exit Code: $STAGE3_EXIT)"

# ------------------------------------------------------------------------------
# 4. Zero-Downtime Rolling Restart Under Active HTTP Traffic
# ------------------------------------------------------------------------------
echo "[4/5] Executing rolling restart with continuous HTTP probing..."
FILE_04="$EVIDENCE_DIR/04-rolling-restart.txt"
STAGE4_EXIT=0
PROBE_LOG=$(mktemp)
TRAFFIC_STOP_FLAG=$(mktemp)
rm -f "$TRAFFIC_STOP_FLAG"

# Launch background curl loop
(
    while [ ! -f "$TRAFFIC_STOP_FLAG" ]; do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$CONNECT_TIMEOUT_SECS" "$HEALTH_URL" 2>/dev/null || echo "000")
        echo "$(date +%s.%N) $CODE" >> "$PROBE_LOG"
        sleep "$PROBE_INTERVAL_SECS"
    done
) &
PROBER_PID=$!

ROLLOUT_START=$(date +%s)
kubectl rollout restart deployment/"$DEPLOYMENT" -n "$NAMESPACE" || STAGE4_EXIT=$?
kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout="${ROLLOUT_TIMEOUT_SECS}s" || STAGE4_EXIT=$?
ROLLOUT_END=$(date +%s)

# Stop traffic prober cleanly
touch "$TRAFFIC_STOP_FLAG"
wait "$PROBER_PID" 2>/dev/null || true
PROBER_PID=""
rm -f "$TRAFFIC_STOP_FLAG"
TRAFFIC_STOP_FLAG=""

TOTAL_PROBES=$(wc -l < "$PROBE_LOG" 2>/dev/null | tr -d ' ' || echo "0")
SUCCESS_PROBES=$(grep -c " 200$" "$PROBE_LOG" 2>/dev/null || echo "0")
FAILED_PROBES=$(grep -v -c " 200$" "$PROBE_LOG" 2>/dev/null || echo "0")
ROLLOUT_SECS=$((ROLLOUT_END - ROLLOUT_START))

{
    echo "=================================================================="
    echo "CineBook Rolling Restart (Zero-Downtime Verification)"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Rollout Duration: ${ROLLOUT_SECS} seconds"
    echo "Timeout Setting:  ${ROLLOUT_TIMEOUT_SECS} seconds"
    echo "=================================================================="
    echo "Total Probes Executed:   $TOTAL_PROBES"
    echo "Successful Probes (200): $SUCCESS_PROBES"
    echo "Failed Probes (non-200): $FAILED_PROBES"
    if [ "$FAILED_PROBES" -eq 0 ] && [ "$STAGE4_EXIT" -eq 0 ]; then
        echo "RESULT: PASS (Zero dropped requests during rolling restart)"
    elif [ "$STAGE4_EXIT" -ne 0 ]; then
        echo "RESULT: FAILED (Rollout command exited with code $STAGE4_EXIT, $FAILED_PROBES failed probes)"
    else
        echo "RESULT: DEGRADED ($FAILED_PROBES requests failed during rollout)"
    fi
    echo ""
    echo "Final Pod Replicas:"
    kubectl get pods -n "$NAMESPACE" -o wide || true
    echo ""
    echo "Stage 4 Exit Code: $STAGE4_EXIT"
} > "$FILE_04"
rm -f "$PROBE_LOG"
PROBE_LOG=""
echo "  -> Saved to $FILE_04 (Exit Code: $STAGE4_EXIT)"

# ------------------------------------------------------------------------------
# 5. HPA Status and Cluster Events (Always executed)
# ------------------------------------------------------------------------------
echo "[5/5] Recording HPA metrics and Kubernetes events..."
FILE_05="$EVIDENCE_DIR/05-hpa-and-events.txt"
STAGE5_EXIT=0
{
    echo "=================================================================="
    echo "CineBook HPA Status & Cluster Events"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
    echo ""
    echo "--- 1. HorizontalPodAutoscaler Status ---"
    if kubectl get hpa -n "$NAMESPACE" 2>/dev/null; then
        kubectl describe hpa cinebook-backend-hpa -n "$NAMESPACE" || STAGE5_EXIT=$?
    else
        echo "HPA check failed or metrics-server not installed in this cluster."
        echo "To install metrics-server on kind with insecure TLS:"
        echo "  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
        echo "  kubectl patch -n kube-system deployment/metrics-server --type='json' -p='[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/args/-\",\"value\":\"--kubelet-insecure-tls\"}]'"
    fi
    echo ""
    echo "--- 2. Recent Kubernetes Namespace Events ---"
    kubectl get events -n "$NAMESPACE" --sort-by='.metadata.creationTimestamp' || STAGE5_EXIT=$?
    echo ""
    echo "Stage 5 Exit Code: $STAGE5_EXIT"
} > "$FILE_05"
echo "  -> Saved to $FILE_05 (Exit Code: $STAGE5_EXIT)"

echo "=================================================================="
echo "Evidence collection complete! Summary:"
echo "  Stage 1 (Bootstrap):       Exit Code $STAGE1_EXIT"
echo "  Stage 2 (Health & Pods):   Exit Code $STAGE2_EXIT"
echo "  Stage 3 (Self-Healing):    Exit Code $STAGE3_EXIT"
echo "  Stage 4 (Rolling Restart): Exit Code $STAGE4_EXIT"
echo "  Stage 5 (HPA & Events):    Exit Code $STAGE5_EXIT"
echo "Files generated in $EVIDENCE_DIR:"
ls -lh "$EVIDENCE_DIR"
echo "=================================================================="
