#!/usr/bin/env bash
# ==============================================================================
# scripts/tf-validate.sh
# Validates Terraform configuration syntax, formatting, and internal consistency.
# Runs locally without requiring AWS cloud credentials or incurring any costs.
# Saves validation output to docs/evidence/terraform-validate.txt.
#
# Usage (run in Git Bash or WSL on Windows):
#   bash scripts/tf-validate.sh
# ==============================================================================
set -euo pipefail

TF_DIR="deploy/terraform"
EVIDENCE_FILE="docs/evidence/terraform-validate.txt"

mkdir -p docs/evidence

echo "=================================================================="
echo "          CineBook Terraform Static Validation Check             "
echo "=================================================================="

{
    echo "=================================================================="
    echo "CineBook Terraform Configuration Validation Report"
    echo "Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "=================================================================="
    echo ""
} > "$EVIDENCE_FILE"

# 1. Prerequisite verification
if ! command -v terraform &>/dev/null; then
    echo "ERROR: 'terraform' CLI is not installed or not in PATH." | tee -a "$EVIDENCE_FILE" >&2
    echo "Install Terraform (>= 1.5.0) to execute syntax validation." | tee -a "$EVIDENCE_FILE" >&2
    exit 1
fi

TERRAFORM_VERSION=$(terraform version | head -n 1)
echo "Terraform Version: $TERRAFORM_VERSION" | tee -a "$EVIDENCE_FILE"
echo "" >> "$EVIDENCE_FILE"

pushd "$TF_DIR" >/dev/null

# 2. Format Check
echo "[1/3] Checking code formatting (terraform fmt -check)..."
echo "--- 1. Format Check (terraform fmt -check) ---" >> "../../$EVIDENCE_FILE"
if terraform fmt -check -diff >> "../../$EVIDENCE_FILE" 2>&1; then
    echo "Formatting: PASS (All HCL code follows canonical formatting style)" | tee -a "../../$EVIDENCE_FILE"
else
    echo "Formatting: FAILED (Code formatting issues detected. Run 'terraform fmt' to fix)" | tee -a "../../$EVIDENCE_FILE"
fi
echo "" >> "../../$EVIDENCE_FILE"

# 3. Initialize Provider in Offline/Validation Mode
echo "[2/3] Initializing provider plugins (terraform init -backend=false)..."
echo "--- 2. Initialization (terraform init -backend=false) ---" >> "../../$EVIDENCE_FILE"
terraform init -backend=false >> "../../$EVIDENCE_FILE" 2>&1

# 4. Configuration Validation
echo "[3/3] Validating configuration syntax (terraform validate)..."
echo "--- 3. Static Configuration Validation (terraform validate) ---" >> "../../$EVIDENCE_FILE"
if terraform validate >> "../../$EVIDENCE_FILE" 2>&1; then
    echo "Validation: PASS (Configuration is syntactically valid and internally consistent)" | tee -a "../../$EVIDENCE_FILE"
else
    echo "Validation: FAILED (Syntax or semantic errors found in Terraform manifests)" | tee -a "../../$EVIDENCE_FILE"
fi

popd >/dev/null

{
    echo ""
    echo "=================================================================="
    echo "SRE OPERATIONAL NOTE:"
    echo "1. 'terraform validate' checks configuration syntax and internal types"
    echo "   without contacting AWS APIs and without requiring credentials."
    echo "2. 'terraform plan' generates an execution diff, requires read-only AWS"
    echo "   credentials, and incurs ZERO cloud costs."
    echo "3. 'terraform apply' and 'terraform destroy' provision and decommission"
    echo "   real cloud resources and should only be run intentionally."
    echo "=================================================================="
} >> "$EVIDENCE_FILE"

echo ""
echo "Terraform validation report saved to: $EVIDENCE_FILE"
