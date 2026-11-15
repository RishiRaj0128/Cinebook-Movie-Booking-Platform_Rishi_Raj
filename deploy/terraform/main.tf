# deploy/terraform/main.tf
# Provisions AWS Free-Tier eligible CineBook infrastructure:
# - Default VPC and Subnet data lookups (zero NAT gateway or VPC hourly charges)
# - Latest Amazon Linux 2023 AMI dynamically queried via AWS SSM Parameter Store
# - Security Group locked down strictly to the student's IP address on port 8080
# - Single EC2 instance (default t3.micro) executing the backend container via user_data
# - AWS Budgets zero-spend safeguard alarm ($1.00 USD monthly threshold)

# ------------------------------------------------------------------------------
# 1. Existing Networking Lookups (Default VPC - Zero Added Cost)
# ------------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ------------------------------------------------------------------------------
# 2. Latest Amazon Linux 2023 AMI via AWS Systems Manager Parameter Store
# ------------------------------------------------------------------------------
data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# ------------------------------------------------------------------------------
# 3. Security Group (Restricted Ingress)
# ------------------------------------------------------------------------------
resource "aws_security_group" "backend" {
  name        = "${var.project_name}-backend-sg"
  description = "Security group for CineBook backend EC2 instance with restricted ingress"
  vpc_id      = data.aws_vpc.default.id

  # Restrict backend HTTP ingress strictly to the student's authorized IP CIDR
  ingress {
    description = "Allow backend REST API access from student authorized IP CIDR"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
  }

  # Outbound access to fetch OS packages and container images
  egress {
    description = "Allow all outbound traffic for OS updates and container image pulls"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-backend-sg"
  }
}

# ------------------------------------------------------------------------------
# 4. EC2 Instance (Single Node, Free-Tier Eligible)
# ------------------------------------------------------------------------------
resource "aws_instance" "backend" {
  ami                         = data.aws_ssm_parameter.al2023_ami.value
  instance_type               = var.instance_type
  subnet_id                   = element(data.aws_subnets.default.ids, 0)
  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true

  # Free-tier standard EBS volume (up to 30 GB gp2/gp3 is free tier eligible)
  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
    tags = {
      Name = "${var.project_name}-root-volume"
    }
  }

  # Automated user_data bootstrap: installs Docker, pulls image, runs with local profile (in-memory H2)
  user_data = <<-EOF
              #!/bin/bash
              set -euo pipefail

              echo "--- Updating OS packages and installing Docker ---"
              dnf update -y
              dnf install -y docker
              systemctl enable --now docker
              usermod -aG docker ec2-user

              echo "--- Starting CineBook Backend Container ---"
              # Runs under in-memory H2 profile; zero external database or cloud credentials needed.
              docker run -d \
                --name cinebook-backend \
                --restart unless-stopped \
                -p 8080:8080 \
                -e SPRING_PROFILES_ACTIVE=local \
                -e MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED=true \
                -e PORT=8080 \
                ghcr.io/rishiraj0128/cinebook-backend:latest
              EOF

  user_data_replace_on_change = true

  tags = {
    Name = "${var.project_name}-backend-instance"
  }
}

# ------------------------------------------------------------------------------
# 5. AWS Budgets Cost Safeguard ($1.00 USD Monthly Threshold)
# ------------------------------------------------------------------------------
resource "aws_budgets_budget" "cost_safeguard" {
  name              = "${var.project_name}-monthly-cost-safeguard"
  budget_type       = "COST"
  limit_amount      = "1.00"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"

  # Alert 1: Actual spend exceeds 80% ($0.80) of free-tier buffer
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }

  # Alert 2: Forecasted spend projected to reach or exceed 100% ($1.00)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_notification_email]
  }
}
