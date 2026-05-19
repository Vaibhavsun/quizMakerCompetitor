output "backend_public_ip" {
  description = "Public IP of the backend EC2 instance. Use for SSH and as VITE_API_URL/VITE_SOCKET_URL host."
  value       = module.backend.public_ip
}

output "backend_public_dns" {
  description = "Public DNS of the backend EC2 instance"
  value       = module.backend.public_dns
}

output "db_endpoint" {
  description = "Private RDS endpoint. Only reachable from inside the VPC."
  value       = module.db.endpoint
}

output "ssh_command" {
  description = "Ready-to-use SSH command"
  value       = "ssh -i ${var.project}-key.pem ec2-user@${module.backend.public_ip}"
}

output "ssh_key_path" {
  description = "Path to the private key written to disk"
  value       = "${path.module}/${var.project}-key.pem"
}

output "frontend_url" {
  description = "Amplify-hosted frontend URL (null until github vars are set + first build completes)"
  value       = module.frontend.amplify_url
  sensitive   = true
}

output "amplify_app_id" {
  description = "Amplify app ID — find this in the AWS console under Amplify"
  value       = module.frontend.amplify_app_id
  sensitive   = true
}

