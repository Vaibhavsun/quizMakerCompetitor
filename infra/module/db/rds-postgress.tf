variable "project"          { type = string }
variable "vpc_id"           { type = string }
variable "private_subnets"  { type = list(string) }
variable "backend_sg_id"    { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}

# RDS subnet group spans the 2 private subnets (AWS requires ≥ 2 AZs).
resource "aws_db_subnet_group" "private" {
  name       = "${var.project}-db-subnet-group"
  subnet_ids = var.private_subnets
  tags       = { Name = "${var.project}-db-subnet-group" }
}

# DB security group — accepts 5432 only from the backend's security group.
resource "aws_security_group" "postgres_sg" {
  name        = "${var.project}-postgres-sg"
  description = "Allow Postgres from backend only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.backend_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-postgres-sg" }
}

resource "aws_db_instance" "postgres" {
  identifier = "${var.project}-postgres-db"

  engine         = "postgres"
  engine_version = "15"

  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "quizdb"
  username = "auth_quiz_vaibhav"
  password = var.db_password

  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.postgres_sg.id]

  auto_minor_version_upgrade = true
  skip_final_snapshot        = true

  timeouts {
    create = "3h"
    update = "3h"
    delete = "3h"
  }
}

output "endpoint" {
  value = aws_db_instance.postgres.address
}
