# deploy/terraform/outputs.tf
# Outputs displaying the provisioned EC2 endpoint and health probe URL.

output "instance_id" {
  description = "The EC2 instance identifier."
  value       = aws_instance.backend.id
}

output "ec2_public_ip" {
  description = "The assigned public IPv4 address of the backend EC2 instance."
  value       = aws_instance.backend.public_ip
}

output "ec2_public_dns" {
  description = "The assigned public DNS hostname of the backend EC2 instance."
  value       = aws_instance.backend.public_dns
}

output "health_url" {
  description = "Actuator health endpoint URL for verifying deployment status."
  value       = "http://${aws_instance.backend.public_ip}:8080/actuator/health"
}
