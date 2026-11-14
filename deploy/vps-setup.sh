#!/usr/bin/env bash
# One-time setup for the GoDaddy VPS (Ubuntu/Debian). Run as a sudo-capable user:
#   bash deploy/vps-setup.sh
# Installs Docker Engine + Compose plugin from Docker's official apt repository and opens ports 22/80/443.
# Status: written 2026-11-14, NOT YET TESTED (no Linux machine available locally).
set -euo pipefail

if ! command -v apt-get >/dev/null; then
  echo "This script supports Ubuntu/Debian only." >&2
  exit 1
fi

. /etc/os-release
echo "OS: $PRETTY_NAME"

if ! command -v docker >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Log out and back in once so 'docker' works without sudo."
else
  echo "Docker already installed: $(docker --version)"
fi

if command -v ufw >/dev/null; then
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
  sudo ufw status
fi

echo
echo "Next: put the project in ~/openramp, create ~/openramp/.env (never commit it), then run:"
echo "  cd ~/openramp && docker compose up -d --build && docker compose ps"
echo "Do NOT run 'docker compose config' with the real .env present: it prints secrets."
