#!/usr/bin/env bash
#
# Tears down everything deploy.sh created.
# Prompts for the same AWS creds so it can authenticate against the right
# account, then empties the S3 bucket (terraform destroy fails on non-empty
# buckets) and runs `terraform destroy`.
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
say()  { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf   "${GREEN}\xE2\x9C\x93${NC} %s\n" "$*"; }
die()  { printf   "${RED}\xE2\x9C\x97${NC} %s\n"   "$*" >&2; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$ROOT_DIR/infra"

[[ -f "$INFRA_DIR/terraform.tfstate" ]] \
    || die "No terraform.tfstate found in $INFRA_DIR - nothing to destroy"

say "Enter AWS credentials (same account that ran deploy.sh)"
read -rp  "  AWS_ACCESS_KEY_ID:     " AWS_ACCESS_KEY_ID
read -rsp "  AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY; echo
read -rp  "  AWS_SESSION_TOKEN (blank if you have permanent creds): " AWS_SESSION_TOKEN || true
read -rp  "  AWS region [eu-north-1]: " AWS_REGION_INPUT
AWS_REGION="${AWS_REGION_INPUT:-eu-north-1}"

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="$AWS_REGION"
if [[ -n "${AWS_SESSION_TOKEN:-}" ]]; then export AWS_SESSION_TOKEN; fi

cd "$INFRA_DIR"

# Empty the S3 bucket so `terraform destroy` can drop it.
if FE_BUCKET=$(terraform output -raw frontend_bucket 2>/dev/null) && [[ -n "$FE_BUCKET" ]]; then
    say "Emptying s3://$FE_BUCKET/"
    aws s3 rm "s3://$FE_BUCKET/" --recursive || true
fi

# tfvars stores db_password; the destroy needs the variable to be set.
DB_PASSWORD="placeholder-for-destroy-only"
if [[ -f terraform.tfvars ]]; then
    DB_PASSWORD=$(grep -E '^db_password' terraform.tfvars | sed -E 's/.*"([^"]*)".*/\1/' || true)
    [[ -n "$DB_PASSWORD" ]] || DB_PASSWORD="placeholder-for-destroy-only"
fi

say "Running terraform destroy"
terraform destroy -auto-approve \
    -var "aws_region=$AWS_REGION" \
    -var "db_password=$DB_PASSWORD"

ok "Infra destroyed. Local terraform.tfvars and .pem are kept - delete them yourself if you want."
