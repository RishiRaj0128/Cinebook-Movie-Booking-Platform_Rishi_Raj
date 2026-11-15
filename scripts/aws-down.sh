#!/usr/bin/env bash
# ==============================================================================
# scripts/aws-down.sh
# Teardown wrapper for CineBook AWS infrastructure.
# Requires explicit confirmation before destroying cloud resources.
#
# Usage (run in Git Bash or WSL on Windows):
#   bash scripts/aws-down.sh
# ==============================================================================
set -euo pipefail

TF_DIR="deploy/terraform"

echo "=================================================================="
echo "          CineBook AWS Infrastructure Teardown                    "
echo "=================================================================="

# 1. Prerequisite verification
if ! command -v terraform &>/dev/null; then
    echo "ERROR: 'terraform' CLI is not installed or not in PATH." >&2
    exit 1
fi

if [ ! -d "$TF_DIR/.terraform" ]; then
    echo "No Terraform state found in '$TF_DIR'. Infrastructure may already be destroyed."
    exit 0
fi

# 2. Confirmation prompt
echo "WARNING: This will permanently destroy all AWS resources created by Terraform:"
echo "  - EC2 Instance"
echo "  - Security Group"
echo "  - AWS Budgets Safeguard"
echo ""
read -r -p "Type 'yes' to confirm destruction of these AWS resources: " CONFIRMATION

if [ "$CONFIRMATION" != "yes" ]; then
    echo "Destruction aborted by user."
    exit 0
fi

# 3. Destroy resources
echo ""
echo "Executing terraform destroy..."
pushd "$TF_DIR" >/dev/null
terraform destroy -auto-approve
popd >/dev/null

echo ""
echo "=================================================================="
echo "  All CineBook AWS resources have been destroyed.                 "
echo "=================================================================="
echo "CRITICAL SRE ACTION:"
echo "Log into the AWS Console (Billing & Cost Management) to verify"
echo "that no orphaned instances, unattached EBS volumes, or active"
echo "budgets remain incurring charges."
echo "=================================================================="
