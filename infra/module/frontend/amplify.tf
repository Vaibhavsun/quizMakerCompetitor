variable "project" { type = string }

variable "github_repo_url" {
  description = "GitHub repo URL, e.g. https://github.com/user/repo. Leave empty to skip provisioning Amplify."
  type        = string
  default     = ""
}

variable "github_access_token" {
  description = "GitHub Personal Access Token with `repo` + `admin:repo_hook` scopes."
  type        = string
  sensitive   = true
  default     = ""
}

variable "branch" {
  description = "Branch Amplify watches for auto-deploys"
  type        = string
  default     = "main"
}

variable "app_root" {
  description = "Subdirectory containing the frontend (monorepo)"
  type        = string
  default     = "client"
}

variable "backend_host" {
  description = "EC2 public IP/DNS of the backend, used as VITE_API_URL/VITE_SOCKET_URL host"
  type        = string
}

# Only provision Amplify once both GitHub values are supplied.
locals {
  enabled = var.github_repo_url != "" && var.github_access_token != ""
}

resource "aws_amplify_app" "site" {
  count = local.enabled ? 1 : 0

  name         = "${var.project}-frontend"
  repository   = var.github_repo_url
  access_token = var.github_access_token

  enable_branch_auto_build = true

  environment_variables = {
    VITE_API_URL    = "http://${var.backend_host}:4000"
    VITE_SOCKET_URL = "http://${var.backend_host}:9000"
  }

  build_spec = <<-YAML
    version: 1
    applications:
      - appRoot: ${var.app_root}
        frontend:
          phases:
            preBuild:
              commands:
                - npm ci
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: dist
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
  YAML

  # SPA fallback: client-side routes (e.g. /rooms/abc/play) need to be
  # rewritten to index.html so React Router can handle them.
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json|webp)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
}

resource "aws_amplify_branch" "main" {
  count = local.enabled ? 1 : 0

  app_id            = aws_amplify_app.site[0].id
  branch_name       = var.branch
  enable_auto_build = true
  framework         = "Vite"
  stage             = "PRODUCTION"
}
