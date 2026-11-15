#!/usr/bin/env bash
# ==============================================================================
# scripts/aws-up.sh
# Automated provisioning wrapper for CineBook AWS Free-Tier infrastructure.
#
# Prerequisite Tools:
#   - terraform (>= 1.5.0)
#   - aws-cli   (configured with credentials: aws configure)
#
# Usage (run in Git Bash or WSL on Windows):
#   bash scripts/aws-up.sh
# ==============================================================================
set -euo pipefail

TF_DIR="deploy/terraform"

echo "=================================================================="
echo "          CineBook AWS Infrastructure Provisioning                "
echo "=================================================================="

# 1. Prerequisite verification
echo "[1/4] Verifying CLI prerequisites..."
for tool in terraform aws; do
    if ! command -v "$tool" &>/dev/null; then
        echo "ERROR: Required tool '$tool' is not installed or not in PATH." >&2
        echo "Please install '$tool' before running this script." >&2
        exit 1
    fi
    echo "  - $tool: FOUND ($(command -v "$tool"))"
done

# Verify AWS credentials
echo "[2/4] Verifying active AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "ERROR: Unable to authenticate with AWS. Please run 'aws configure' or set AWS_PROFILE/AWS_ACCESS_KEY_ID." >&2
    exit 1
fi
ACTIVE_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
echo "  - Authenticated to AWS Account ID: $ACTIVE_ACCOUNT"

# Check for terraform.tfvars
if [ ! -f "$TF_DIR/terraform.tfvars" ]; then
    echo ""
    echo "WARNING: '$TF_DIR/terraform.tfvars' does not exist."
    echo "Creating it from '$TF_DIR/terraform.tfvars.example'..."
    cp "$TF_DIR/terraform.tfvars.example" "$TF_DIR/terraform.tfvars"
    echo "Please edit '$TF_DIR/terraform.tfvars' with your actual IP and email before re-running."
    exit 1
fi

# 2. Terraform Initialization
echo "[3/4] Initializing Terraform providers and backend..."
pushd "$TF_DIR" >/dev/null
terraform init

# 3. Plan & Apply
echo "[4/4] Generating execution plan and applying..."
terraform plan -out=tfplan
terraform apply -auto-approve tfplan
rm -f tfplan

echo ""
echo "=================================================================="
echo "  CineBook AWS Infrastructure successfully provisioned!           "
echo "=================================================================="
terraform output
popd >/dev/null

echo ""
echo "Note: The EC2 instance will take 1-2 minutes to install Docker and start the container."
echo "Check the health URL above once initialization completes."
