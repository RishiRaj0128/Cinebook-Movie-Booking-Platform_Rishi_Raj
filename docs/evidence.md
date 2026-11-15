# CineBook SRE & DevOps Evidence Matrix

This checklist maps technical resume claims and platform capabilities directly to reproducible verification commands and recorded output artifacts in `docs/evidence/`.

> **Instructions for Candidate**: Run the verification commands listed below on your workstation. The status column is initially left blank for you to mark as `VERIFIED` once you have executed the command and confirmed the output file exists in `docs/evidence/`.

| Resume / Technical Claim | Command That Proves It | Output File in `docs/evidence/` | Status (Fill after running) |
|---|---|---|---|
| **Kubernetes Pods Ready** | `bash scripts/k8s-up.sh && kubectl get pods -n cinebook -o wide` | `docs/evidence/02-pods-and-health.txt` | [ ] |
| **Health & Probes over kind** | `curl -s -i http://localhost:30080/actuator/health` | `docs/evidence/02-pods-and-health.txt` | [ ] |
| **Pod Self-Healing Drill** | `bash scripts/collect-evidence.sh` (Step 3: Pod termination & recovery) | `docs/evidence/03-self-healing.txt` | [ ] |
| **Zero-Downtime Rolling Restart** | `bash scripts/collect-evidence.sh` (Step 4: Rollout restart under active traffic) | `docs/evidence/04-rolling-restart.txt` | [ ] |
| **HPA Metrics & Event Log** | `kubectl get hpa -n cinebook && kubectl get events -n cinebook` | `docs/evidence/05-hpa-and-events.txt` | [ ] |
| **Terraform Syntax & Validation** | `bash scripts/tf-validate.sh` | `docs/evidence/terraform-validate.txt` | [ ] |
| **Terraform Apply on AWS** | `bash scripts/aws-up.sh` | `docs/evidence/06-aws-apply.txt` | [ ] |
| **Health URL on EC2** | `curl -s -i http://<EC2_PUBLIC_IP>:8080/actuator/health` | `docs/evidence/07-ec2-health.txt` | [ ] |
| **Terraform Clean Teardown** | `bash scripts/aws-down.sh` | `docs/evidence/08-aws-destroy.txt` | [ ] |
| **AWS Zero-Spend Billing Check** | Inspect AWS Cost Explorer & Active Resources in AWS Console | `docs/evidence/09-billing-check.png` | [ ] |
| **Custom Domain Resolution** | `curl -sI https://cinebook.yourdomain.com` | `docs/evidence/10-custom-domain.txt` | [ ] |
| **GitHub Actions CI Green** | View GitHub Actions tab on GitHub repository | `docs/evidence/11-ci-green.png` | [ ] |
