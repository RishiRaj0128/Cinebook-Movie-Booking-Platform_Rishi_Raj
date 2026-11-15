# deploy/terraform/providers.tf
# Configures the AWS Provider and required Terraform version.
# Uses default_tags to ensure every provisioned cloud resource is tagged for cost attribution.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Owner       = var.owner
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
