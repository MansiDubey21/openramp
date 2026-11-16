#!/usr/bin/env bash
# Build and (re)start OpenRamp on the VPS. Run from the project folder:  bash deploy/deploy.sh
# Safe by design: checks .env WITHOUT printing any values, then builds, starts and waits for health.
set -euo pipefail
cd "$(dirname "$0")/.."

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

# 1. Secrets file checks (values are never printed)
[ -f .env ] || { red "Missing .env. Run: cp .env.example .env && nano .env && chmod 600 .env"; exit 1; }
chmod 600 .env
missing=0
for key in ANTHROPIC_API_KEY DOMAIN SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS CONTACT_TO; do
  line=$(grep -E "^${key}=" .env || true)
  value=${line#*=}
  if [ -z "$value" ]; then red "  $key: not set"; missing=1
  elif printf '%s' "$value" | grep -qiE 'REPLACE_ME|yourdomain\.com'; then red "  $key: still a placeholder"; missing=1
  else green "  $key: set"; fi
done
if [ "$missing" = 1 ]; then
  red "Some settings are missing. The app still runs, but the contact form/HTTPS need them."
  read -r -p "Continue anyway? [y/N] " ok; [ "${ok:-N}" = "y" ] || exit 1
fi

# 2. Get the latest code (if this is a git checkout)
if [ -d .git ]; then git pull --ff-only; fi

# 3. Build and start
docker compose up -d --build

# 4. Wait for the app's health check
echo "Waiting for the app to become healthy..."
for i in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)
  [ "$status" = healthy ] && break
  sleep 3
done
docker compose ps
[ "$status" = healthy ] || { red "App is not healthy. Recent logs:"; docker compose logs --tail=60 app; exit 1; }
green "App is healthy."

# 5. DNS + HTTPS hints
domain=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)
server_ip=$(curl -fsS -4 https://api.ipify.org || echo unknown)
dns_ip=$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1{print $1}' || true)
echo "Server public IP: $server_ip   |   $domain resolves to: ${dns_ip:-not yet}"
if [ -n "$dns_ip" ] && [ "$dns_ip" = "$server_ip" ]; then
  echo "Checking https://$domain/api/health ..."
  curl -fsS --max-time 20 "https://$domain/api/health" && echo && green "HTTPS is working." \
    || red "HTTPS not ready yet (certificate may take a minute). Check: docker compose logs caddy"
else
  red "Point the domain's A record to $server_ip, then re-run this script."
fi
