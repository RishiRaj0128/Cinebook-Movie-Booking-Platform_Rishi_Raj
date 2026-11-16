# CineBook SRE Deployment Evidence Directory

This directory stores real terminal outputs, measured timings, and verification logs proving the deployment, reliability, and observability claims made in the resume and documentation.

## How Evidence is Generated

Run the automated evidence collection script from Git Bash or WSL on Windows:

```bash
bash scripts/collect-evidence.sh
```

This will run an end-to-end kind cluster deployment, measure self-healing failover timings, execute rolling restart zero-downtime traffic tests, and record real outputs into numbered files:

- `01-k8s-up.txt`: Timed cluster provisioning, image sideloading, and manifest rollout log.
- `02-pods-and-health.txt`: Pod network inventory, deployment specification, and `/actuator/health` HTTP responses.
- `03-self-healing.txt`: Real recovery duration (in seconds) after unannounced pod termination.
- `04-rolling-restart.txt`: Real request success/failure ratio under continuous traffic during rolling rollout.
- `05-hpa-and-events.txt`: Autoscaler metrics and cluster lifecycle events.
- `terraform-validate.txt`: Output from `bash scripts/tf-validate.sh` validating Terraform syntax and configuration.
- `run-1-rolling-restart-timeout.txt`: Unedited console log of initial test run documenting rolling restart timeout analysis.

## Run 1 Incident Analysis & Resolution

During the initial execution (`run-1-rolling-restart-timeout.txt`), Stages 1 through 3 succeeded: the kind cluster was bootstrapped, health probes responded with HTTP 200, and a pod kill self-healing drill recovered in 77 seconds. However, Stage 4 (rolling restart under continuous HTTP traffic) timed out at 120 seconds (`error: timed out waiting for the condition`). With `replicas: 2` and default `maxUnavailable: 25%` (rounded down to 0), Kubernetes enforces zero downtime by rolling out replacements sequentially: Pod 1 boots Spring Boot (~57s on 500m CPU limit) and passes readiness probes (~65s total), after which Old Pod 1 is deleted and Pod 2 is created (~60s), totaling ~130–135 seconds. The test timeout was reached ~15 seconds before Pod 2 finished initialization (both pods completed startup cleanly immediately after). To resolve this, `ROLLOUT_TIMEOUT_SECS` was parameterized and set to 240s in both `scripts/collect-evidence.sh` and `scripts/k8s-up.sh`, an `EXIT INT TERM` trap was introduced to guarantee termination of the background HTTP traffic prober, and stage execution was structured to record exit codes in each log while ensuring Stage 5 (HPA and events) always runs.

## Execution Isolation & Timing Reference

- **Workload Isolation**: Docker Compose was fully stopped and cleaned up (`docker compose down -v`) at 11:32:37 UTC, 1 minute and 53 seconds before the first kind cluster bootstrap began (11:34:30 UTC). Docker Compose build and run did not overlap with kind execution.
- **Bootstrap Duration Metric (185s)**: The 185s duration in `01-k8s-up.txt` reflects the full end-to-end execution of `scripts/k8s-up.sh` from a clean system: downloading the ~1 GB `kindest/node:v1.37.0` container image from Docker Hub over the internet, provisioning the control-plane container, sideloading the 477MB `cinebook-backend:latest` image into kind, applying Kubernetes manifests, and waiting for both replicas to cold-start JVMs and pass health probes.

> **Honesty Notice**: In accordance with SRE honesty rules, this directory contains only real, unedited command outputs generated directly on this host. No benchmark numbers or test outputs are fabricated.
