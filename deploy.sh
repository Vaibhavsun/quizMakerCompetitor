#!/usr/bin/env bash
#
# One-command deploy for QuizCompetitionMaker.
# Provisions the AWS infra with Terraform, ships the backend to EC2 (via SSH +
# pm2), pushes the Prisma schema to RDS, builds the React client with the new
# backend URLs baked in, and syncs it to S3.
#
# Re-run safely: every step is idempotent.
#
set -euo pipefail

# ── pretty printers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
say()  { printf "\n${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf   "${GREEN}\xE2\x9C\x93${NC} %s\n" "$*"; }
warn() { printf   "${YELLOW}!${NC} %s\n" "$*"; }
die()  { printf   "${RED}\xE2\x9C\x97${NC} %s\n" "$*" >&2; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$ROOT_DIR/infra"
BACKEND_DIR="$ROOT_DIR/backend"
CLIENT_DIR="$ROOT_DIR/client"

# ── 1. prerequisites ─────────────────────────────────────────────────────────
say "Checking prerequisites"
MISSING=()
for cmd in terraform aws ssh scp rsync node npm jq; do
    command -v "$cmd" >/dev/null 2>&1 || MISSING+=("$cmd")
done
if (( ${#MISSING[@]} )); then
    die "Missing on PATH: ${MISSING[*]}  (install them and re-run)"
fi
ok "All prereqs present"

# ── 2. collect inputs (skips prompts when values are already known) ──────────
# AWS creds: reuse env/profile if `aws sts get-caller-identity` already works.
if aws sts get-caller-identity >/dev/null 2>&1; then
    say "Reusing AWS credentials already configured for this shell"
    aws sts get-caller-identity --output table
    AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || true)}}"
    AWS_REGION="${AWS_REGION:-eu-north-1}"
    echo "  Region: $AWS_REGION"
else
    say "Enter AWS credentials (exported for this shell only, not written to disk)"
    read -rp  "  AWS_ACCESS_KEY_ID:     " AWS_ACCESS_KEY_ID
    read -rsp "  AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY; echo
    read -rp  "  AWS_SESSION_TOKEN (blank if you have permanent creds): " AWS_SESSION_TOKEN || true
    read -rp  "  AWS region [eu-north-1]: " AWS_REGION_INPUT
    AWS_REGION="${AWS_REGION_INPUT:-eu-north-1}"
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
    [[ -n "${AWS_SESSION_TOKEN:-}" ]] && export AWS_SESSION_TOKEN
    say "Verifying AWS credentials"
    aws sts get-caller-identity --output table \
        || die "AWS auth failed - check the access key / secret / session token"
    ok "Credentials accepted"
fi
export AWS_DEFAULT_REGION="$AWS_REGION"

# DB password: reuse from infra/terraform.tfvars if present and clean.
say "Application secrets"
DB_PASSWORD=""
if [[ -f "$INFRA_DIR/terraform.tfvars" ]]; then
    EXISTING=$(sed -nE 's/^db_password[[:space:]]*=[[:space:]]*"(.*)"[[:space:]]*$/\1/p' \
        "$INFRA_DIR/terraform.tfvars" 2>/dev/null || true)
    if [[ -n "$EXISTING" && ! "$EXISTING" =~ [[:cntrl:]] && ${#EXISTING} -ge 8 ]]; then
        DB_PASSWORD="$EXISTING"
        ok "Reusing Postgres password from existing terraform.tfvars"
    elif [[ -n "$EXISTING" ]]; then
        warn "Existing tfvars password is invalid (too short or has control chars), re-prompting"
    fi
fi
if [[ -z "$DB_PASSWORD" ]]; then
    read -rsp "  Postgres master password (min 8 chars, no arrow keys): " DB_PASSWORD; echo
    [[ ${#DB_PASSWORD} -ge 8 ]]            || die "Password must be at least 8 characters"
    [[ ! "$DB_PASSWORD" =~ [[:cntrl:]] ]]  || die "Password contains control characters (did you press an arrow key?)"
fi

# OpenAI key: reuse from env var or cached file, otherwise prompt + cache.
OPENAI_KEY_CACHE="$INFRA_DIR/.openai-key"
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    ok "Reusing OPENAI_API_KEY from environment"
elif [[ -f "$OPENAI_KEY_CACHE" ]]; then
    OPENAI_API_KEY="$(tr -d '[:space:]' < "$OPENAI_KEY_CACHE")"
    if [[ -n "$OPENAI_API_KEY" && ! "$OPENAI_API_KEY" =~ [[:cntrl:]] ]]; then
        ok "Reusing OpenAI key from $OPENAI_KEY_CACHE"
    else
        warn "Cached OpenAI key is empty or invalid, re-prompting"
        OPENAI_API_KEY=""
    fi
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    read -rsp "  OpenAI API key (required - backend won't start without it): " OPENAI_API_KEY; echo
    [[ -n "$OPENAI_API_KEY" ]]                || die "OPENAI_API_KEY is required"
    [[ ! "$OPENAI_API_KEY" =~ [[:cntrl:]] ]]  || die "OPENAI_API_KEY contains control characters"
    # Persist for next run (gitignored, mode 0600).
    (umask 077 && printf '%s\n' "$OPENAI_API_KEY" > "$OPENAI_KEY_CACHE")
    ok "Cached OpenAI key to $OPENAI_KEY_CACHE for future runs"
fi

# ── 4. terraform apply ───────────────────────────────────────────────────────
say "Provisioning infrastructure with Terraform"
cd "$INFRA_DIR"

# tfvars is gitignored; safe to (re)write each run.
umask 077
cat > terraform.tfvars <<EOF
db_password = "$DB_PASSWORD"
EOF
umask 022

terraform init -upgrade -input=false
terraform apply -auto-approve -input=false -var "aws_region=$AWS_REGION"
ok "Infra is up"

# ── 5. capture outputs ───────────────────────────────────────────────────────
say "Reading Terraform outputs"
TF_OUT="$(terraform output -json)"
BACKEND_IP=$(jq -r '.backend_public_ip.value'  <<<"$TF_OUT")
DB_ENDPOINT=$(jq -r '.db_endpoint.value'       <<<"$TF_OUT")
FE_BUCKET=$(jq -r   '.frontend_bucket.value'   <<<"$TF_OUT")
FE_URL=$(jq -r      '.frontend_url.value'      <<<"$TF_OUT")
KEY_PATH=$(jq -r    '.ssh_key_path.value'      <<<"$TF_OUT")
# Terraform returns this relative to its module dir ("./quiz-key.pem"); we cd
# around later, so resolve it to an absolute path now.
KEY_PATH="$INFRA_DIR/$(basename "$KEY_PATH")"
[[ -f "$KEY_PATH" ]] || die "SSH key not found at $KEY_PATH"

cat <<EOF
  backend EC2  : $BACKEND_IP
  RDS endpoint : $DB_ENDPOINT
  S3 bucket    : $FE_BUCKET
  Frontend URL : $FE_URL
EOF

# ── 6. wait for SSH + cloud-init ─────────────────────────────────────────────
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=5)
SSH=(ssh "${SSH_OPTS[@]}" -i "$KEY_PATH" "ec2-user@$BACKEND_IP")

say "Waiting for EC2 SSH to accept connections (up to 5 min)"
for i in $(seq 1 60); do
    if "${SSH[@]}" true 2>/dev/null; then ok "SSH up"; break; fi
    sleep 5
    [[ $i -eq 60 ]] && die "EC2 never opened SSH"
done

say "Waiting for cloud-init (Node/git/pm2 install) to finish"
"${SSH[@]}" "sudo cloud-init status --wait" || warn "cloud-init reported non-zero, continuing anyway"

# ── 7. build frontend with backend URL baked in ──────────────────────────────
say "Installing frontend dependencies"
cd "$CLIENT_DIR"
npm install
ok "Frontend deps installed"

say "Building frontend"
cat > .env.production.local <<EOF
VITE_API_URL=http://$BACKEND_IP:4000
VITE_SOCKET_URL=http://$BACKEND_IP:9000
EOF
npm run build
ok "Frontend built"

# ── 8. sync to S3 ────────────────────────────────────────────────────────────
say "Syncing dist/ to s3://$FE_BUCKET/"
aws s3 sync dist/ "s3://$FE_BUCKET/" --delete
ok "Frontend deployed"

# ── 9. ship backend to EC2 ───────────────────────────────────────────────────
say "Ensuring rsync is installed on EC2"
"${SSH[@]}" "command -v rsync >/dev/null 2>&1 || sudo dnf install -y rsync"

say "Shipping backend code to EC2"
"${SSH[@]}" "mkdir -p ~/backend"
rsync -az --delete \
    --exclude node_modules --exclude .env --exclude generated \
    -e "ssh ${SSH_OPTS[*]} -i $KEY_PATH" \
    "$BACKEND_DIR/" "ec2-user@$BACKEND_IP:~/backend/"

say "Writing remote .env"
DATABASE_URL="postgresql://auth_quiz_vaibhav:${DB_PASSWORD}@${DB_ENDPOINT}:5432/quizdb"
"${SSH[@]}" "umask 077 && cat > ~/backend/.env" <<EOF
PORT=4000
SOCKET_PORT=9000
DATABASE_URL=$DATABASE_URL
CORS_ORIGIN=$FE_URL,http://localhost:5173
QUESTION_DURATION_MS=10000
RECONNECT_WINDOW_MS=60000
OPENAI_API_KEY=$OPENAI_API_KEY
EOF

say "Installing deps, syncing Prisma schema, starting via pm2"
"${SSH[@]}" bash <<'REMOTE'
set -eux
cd ~/backend
npm install --omit=dev --no-audit --no-fund
npx prisma generate
npx prisma db push --skip-generate
pm2 delete quiz-backend 2>/dev/null || true
pm2 start server.js --name quiz-backend --update-env
pm2 save
REMOTE
ok "Backend running under pm2 as 'quiz-backend'"

# ── 10. done ─────────────────────────────────────────────────────────────────
cat <<EOF

${GREEN}\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90${NC}
  Frontend  : $FE_URL
  REST API  : http://$BACKEND_IP:4000
  Socket.IO : http://$BACKEND_IP:9000
  SSH       : ssh -i $KEY_PATH ec2-user@$BACKEND_IP
  Logs      : ssh -i $KEY_PATH ec2-user@$BACKEND_IP 'pm2 logs quiz-backend'
  Teardown  : ./destroy.sh
------------------------------------------------------------
EOF
