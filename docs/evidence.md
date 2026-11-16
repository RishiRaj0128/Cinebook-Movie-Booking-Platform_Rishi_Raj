# CineBook SRE & DevOps Evidence Matrix

This checklist maps technical resume claims and platform capabilities directly to reproducible verification commands and recorded output artifacts in `docs/evidence/`.

> **Instructions for Candidate**: Run the verification commands listed below on your workstation. The status column is initially left blank for you to mark as `VERIFIED` once you have executed the command and confirmed the output file exists in `docs/evidence/`.

| Resume / Technical Claim | Command That Proves It | Output File in `docs/evidence/` | Status (Fill after running) |
|---|---|---|---|
| **Backend Unit & Integration Tests** | `mvn test` (GraalVM JDK 21, 19/19 passed) | `docs/evidence/backend-tests.txt` | [x] VERIFIED (19 passed, 0 failures, 14.5s) |
| **Docker Compose Full Stack** | `docker compose up --build -d` (Postgres, Redis, Backend, Frontend) | `docs/evidence/docker-compose.txt` | [x] VERIFIED (All 4 Up, Backend 200, Frontend 200) |
| **Kubernetes Pods Ready** | `bash scripts/k8s-up.sh && kubectl get pods -n cinebook -o wide` | `docs/evidence/02-pods-and-health.txt` | [x] VERIFIED (2/2 replicas Ready in 84s) |
| **Health & Probes over kind** | `curl -s -i http://localhost:30080/actuator/health` | `docs/evidence/02-pods-and-health.txt` | [x] VERIFIED (HTTP 200 on /health, /liveness, /readiness) |
| **Pod Self-Healing Drill** | `bash scripts/collect-evidence.sh` (Step 3: Pod termination & recovery) | `docs/evidence/03-self-healing.txt` | [x] VERIFIED (Recovered 2/2 in 77s) |
| **Zero-Downtime Rolling Restart** | `bash scripts/collect-evidence.sh` (Step 4: Rollout restart under active traffic) | `docs/evidence/04-rolling-restart.txt` | [x] VERIFIED (240/242 probes 200 OK, 151s rollout) |
| **HPA Metrics & Event Log** | `kubectl get hpa -n cinebook && kubectl get events -n cinebook` | `docs/evidence/05-hpa-and-events.txt` | [x] VERIFIED (metrics-server active, 11%/70% CPU) |
| **Terraform Syntax & Validation** | `bash scripts/tf-validate.sh` | `docs/evidence/terraform-validate.txt` | [x] VERIFIED (fmt -check PASS, validate PASS) |
| **Terraform Apply on AWS** | `bash scripts/aws-up.sh` | `docs/evidence/06-aws-apply.txt` | [ ] (Ready for AWS run) |
| **Health URL on EC2** | `curl -s -i http://<EC2_PUBLIC_IP>:8080/actuator/health` | `docs/evidence/07-ec2-health.txt` | [ ] (Ready for AWS run) |
| **Terraform Clean Teardown** | `bash scripts/aws-down.sh` | `docs/evidence/08-aws-destroy.txt` | [ ] (Ready for AWS run) |
| **AWS Zero-Spend Billing Check** | Inspect AWS Cost Explorer & Active Resources in AWS Console | `docs/evidence/09-billing-check.png` | [ ] (Pending AWS run) |
| **Custom Domain Resolution** | `curl -sI https://cinebook.yourdomain.com` | `docs/evidence/10-custom-domain.txt` | [ ] (Pending custom DNS) |
| **GitHub Actions CI Green** | View GitHub Actions tab on GitHub repository | `docs/evidence/11-ci-green.png` | [ ] (Pending remote push) |
