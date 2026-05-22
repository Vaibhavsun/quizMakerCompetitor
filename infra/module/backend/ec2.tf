variable "project"          { type = string }
variable "vpc_id"           { type = string }
variable "public_subnet_id" { type = string }
variable "ssh_cidr"         { type = string }
variable "app_ports"        { type = list(number) }
variable "key_name"         { type = string }

# Latest Amazon Linux 2023 AMI
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# Security group — SSH from your IP only, app ports open to the world.
resource "aws_security_group" "backend" {
  name        = "${var.project}-backend-sg"
  description = "SSH + app ports for quiz backend"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH from operator IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  dynamic "ingress" {
    for_each = toset(var.app_ports)
    content {
      description = "App port ${ingress.value}"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-backend-sg" }
}

resource "aws_instance" "backend" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = "t3.micro"
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [aws_security_group.backend.id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  # Bootstrap: install Node 20, git, and pm2. The actual app deploy is
  # manual — SSH in and clone/run after Terraform finishes.
  user_data = <<-EOF
    #!/bin/bash
    set -eux
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs git rsync
    npm install -g pm2
  EOF

  tags = { Name = "${var.project}-backend" }

  # user_data runs only at first boot; ignoring it here prevents Terraform from
  # replacing the live instance whenever we tweak the bootstrap script.
  # ami is also ignored so a newer AL2023 release doesn't force a replacement.
  lifecycle {
    ignore_changes = [user_data, ami]
  }
}
