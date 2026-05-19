provider "aws" {
  region = var.aws_region
}

# Fetch the caller's public IP so SSH can be locked down to it.
data "http" "my_ip" {
  url = "https://checkip.amazonaws.com/"
}

locals {
  my_cidr = "${chomp(data.http.my_ip.response_body)}/32"
}

# ── network ────────────────────────────────────────────────────────────────
module "network" {
  source = "./module/network"

  project    = var.project
  aws_region = var.aws_region
}

# ── database (private subnets) ─────────────────────────────────────────────
module "db" {
  source = "./module/db"

  project           = var.project
  db_password       = var.db_password
  private_subnets   = module.network.private_subnet_ids
  backend_sg_id     = module.backend.security_group_id
  vpc_id            = module.network.vpc_id
}

# ── frontend (AWS Amplify Hosting) ─────────────────────────────────────────
# Stays a no-op until you fill in `github_repo_url` and `github_access_token`
# in terraform.tfvars. Then `terraform apply` again to provision Amplify.
module "frontend" {
  source              = "./module/frontend"
  project             = var.project
  github_repo_url     = var.github_repo_url
  github_access_token = var.github_access_token
  backend_host        = module.backend.public_ip
}

# ── backend EC2 (public subnet) ────────────────────────────────────────────
module "backend" {
  source = "./module/backend"

  project          = var.project
  vpc_id           = module.network.vpc_id
  public_subnet_id = module.network.public_subnet_id
  ssh_cidr         = local.my_cidr
  app_ports        = var.app_ports
  key_name         = aws_key_pair.backend.key_name
}

# ── SSH key pair (private key written into this folder) ────────────────────
resource "tls_private_key" "backend" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "backend" {
  key_name   = "${var.project}-key"
  public_key = tls_private_key.backend.public_key_openssh
}

resource "local_sensitive_file" "private_key" {
  content         = tls_private_key.backend.private_key_pem
  filename        = "${path.module}/${var.project}-key.pem"
  file_permission = "0400"
}
