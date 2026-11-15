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

> **Honesty Notice**: In accordance with SRE honesty rules, this directory starts clean. No benchmark numbers or test outputs are fabricated; all evidence files must be generated and committed by running the scripts directly on your workstation and AWS environment.
