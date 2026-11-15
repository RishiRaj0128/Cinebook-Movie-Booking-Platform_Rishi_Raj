# deploy/terraform/variables.tf
# Input variables for CineBook AWS Free-Tier deployment.

variable "aws_region" {
  type        = string
  description = "Target AWS region for infrastructure deployment (e.g. us-east-1, ap-south-1)."
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type. Must be verified against your AWS account's free-tier eligibility (t2.micro for older accounts, t3.micro for newer accounts/regions)."
  default     = "t3.micro"
}

variable "my_ip_cidr" {
  type        = string
  description = "Public IP address in CIDR notation (e.g., '203.0.113.25/32') allowed to access the backend REST API on port 8080."
}

variable "budget_notification_email" {
  type        = string
  description = "Email address for AWS Budgets cost alerts to prevent unexpected billing beyond free tier."
}

variable "project_name" {
  type        = string
  description = "Project name used for tagging and resource naming."
  default     = "cinebook"
}

variable "environment" {
  type        = string
  description = "Deployment environment identifier."
  default     = "dev"
}

variable "owner" {
  type        = string
  description = "Resource owner identifier for cost tracking and accountability."
  default     = "student"
}
