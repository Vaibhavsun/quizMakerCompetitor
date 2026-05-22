variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-north-1"
}

variable "project" {
  description = "Prefix used for resource names"
  type        = string
  default     = "quiz"
}

variable "db_password" {
  description = "Postgres master password. Set in terraform.tfvars; never commit it."
  type        = string
  sensitive   = true
}

variable "app_ports" {
  description = "Ports exposed by the backend EC2 (REST + Socket.IO)"
  type        = list(number)
  default     = [4000, 9000]
}

