#!/usr/bin/env bash
# Switch OpenRamp from "IP mode" (http://SERVER_IP) to the real domain with HTTPS — safely.
#
#   bash deploy/go-live.sh openramp.in          manual run (prints what it is doing)
#   bash deploy/go-live.sh openramp.in --auto   from cron: silently waits until DNS points here, runs once
#
# Safety:
#   * does nothing until the domain's A record (public DNS) equals this server's IP
#   * backs up .env and changes ONLY the DOMAIN= line; no values are ever printed
#   * after switching, verifies real HTTPS (valid Let's Encrypt certificate) from this server
#   * if verification fails, automatically restores IP mode so the site stays up
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN_NAME="${1:?usage: go-live.sh <domain> [--auto]}"
MODE="${2:-manual}"
STATE="$HOME/.openramp-golive"
LOG="$HOME/go-live.log"
mkdir -p "$STATE"

say() { echo "$(date -u '+%F %T UTC') $*" | tee -a "$LOG"; }
quiet() { [ "$MODE" = --auto ] || echo "$*"; }

[ -f "$STATE/done-$DOMAIN_NAME" ] && { quiet "Already live on https://$DOMAIN_NAME (remove $STATE/done-$DOMAIN_NAME to run again)."; exit 0; }
[ "$MODE" = --auto ] && [ -f "$STATE/failed-$DOMAIN_NAME" ] && exit 0   # a failed attempt stops auto-retries until a manual run
exec 9>"$STATE/lock"; flock -n 9 || exit 0                # never run twice at the same time

# ---------- 1. Is DNS ready? ----------
server_ip=$(curl -fsS -4 --max-time 10 https://api.ipify.org || true)
[ -n "$server_ip" ] || { quiet "Could not determine this server's public IP."; exit 1; }
# "|| true": a name that does not resolve yet must give an empty answer, not abort the script (set -e + pipefail)
a_record() { { dig +short +time=5 +tries=2 A "$1" @"$2" 2>/dev/null | grep -E '^[0-9.]+$' | sort | tr '\n' ' ' | sed 's/ $//'; } || true; }
apex_g=$(a_record "$DOMAIN_NAME" 8.8.8.8); apex_c=$(a_record "$DOMAIN_NAME" 1.1.1.1)
www_g=$(a_record "www.$DOMAIN_NAME" 8.8.8.8)
if [ "$apex_g" != "$server_ip" ] || [ "$apex_c" != "$server_ip" ]; then
  quiet "DNS not ready: $DOMAIN_NAME → Google: '${apex_g:-none}', Cloudflare: '${apex_c:-none}' (need exactly $server_ip). Nothing changed."
  exit 0
fi
[ "$www_g" = "$server_ip" ] || say "WARNING: www.$DOMAIN_NAME → '${www_g:-none}' (not $server_ip yet). Proceeding with $DOMAIN_NAME; www will get its certificate once its DNS is fixed."

say "DNS ready ($DOMAIN_NAME → $server_ip). Switching to HTTPS…"

# ---------- 2. Set DOMAIN in .env (backup first; values never printed) ----------
[ -f .env ] || { say "ERROR: .env missing"; exit 1; }
backup=".env.bak-golive-$(date -u +%Y%m%d%H%M%S)"
cp -p .env "$backup"; chmod 600 "$backup"
if grep -qE '^DOMAIN=' .env; then sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN_NAME|" .env; else echo "DOMAIN=$DOMAIN_NAME" >> .env; fi
chmod 600 .env
say "DOMAIN set in .env (backup: $backup)"

rollback() {
  say "ROLLBACK: restoring IP mode (http://$server_ip)…"
  docker compose stop caddy >/dev/null 2>&1 || true
  docker compose rm -f caddy >/dev/null 2>&1 || true
  cp -p "$backup" .env
  docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d app >/dev/null 2>&1 || true
  touch "$STATE/failed-$DOMAIN_NAME"
  say "ROLLBACK done. Site is back on http://$server_ip. Check: docker compose logs caddy"
  exit 1
}

# ---------- 3. Switch: app behind Caddy (HTTPS) ----------
if ! docker compose up -d --build >>"$LOG" 2>&1; then rollback; fi

# ---------- 4. Verify real HTTPS (certificate must validate) ----------
ok=""
for i in $(seq 1 40); do
  if curl -fsS --max-time 10 --resolve "$DOMAIN_NAME:443:127.0.0.1" "https://$DOMAIN_NAME/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 6
done
[ -n "$ok" ] || { say "HTTPS did not come up within 4 minutes."; rollback; }
redir=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$DOMAIN_NAME:80:127.0.0.1" "http://$DOMAIN_NAME/")
say "VERIFIED: https://$DOMAIN_NAME/api/health OK (valid certificate); http:// → $redir redirect."
touch "$STATE/done-$DOMAIN_NAME"; rm -f "$STATE/failed-$DOMAIN_NAME"
say "LIVE: https://$DOMAIN_NAME"
