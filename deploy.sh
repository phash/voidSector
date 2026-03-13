#!/usr/bin/env bash
set -euo pipefail

# deploy.sh — voidSector Testrechner-Deployment
#
# Optionen:
#   --keep-tunnel    Cloudflared-Container nicht neu starten (URL bleibt erhalten)
#   --branch <name>  Branch auschecken vor dem Deploy (Standard: aktueller Branch)
#   --no-pull        Kein git pull

KEEP_TUNNEL=false
BRANCH=""
NO_PULL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --keep-tunnel) KEEP_TUNNEL=true; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --no-pull) NO_PULL=true; shift ;;
    *) echo "Unbekannte Option: $1"; echo "Verwendung: $0 [--keep-tunnel] [--branch <name>] [--no-pull]"; exit 1 ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║    voidSector Deploy                 ║"
echo "╚══════════════════════════════════════╝"
echo "  keep-tunnel : $KEEP_TUNNEL"
[[ -n "$BRANCH" ]] && echo "  branch      : $BRANCH"
echo ""

# ── Git ──────────────────────────────────────────────────────────────────────
if [[ "$NO_PULL" = false ]]; then
  echo "── Git ──────────────────────────────────"
  if [[ -n "$BRANCH" ]]; then
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
  else
    git pull
  fi
  echo ""
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo "── Docker Build ─────────────────────────"
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build server client
echo ""

# ── Start / Restart ──────────────────────────────────────────────────────────
echo "── Services starten ─────────────────────"
if [[ "$KEEP_TUNNEL" = true ]]; then
  # Cloudflared-Container NICHT anfassen → URL bleibt gleich
  # Falls cloudflared noch nicht läuft, trotzdem starten
  if ! docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps cloudflared --status running 2>/dev/null | grep -q "running"; then
    echo "  cloudflared läuft nicht → starte einmalig"
    docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d cloudflared
  else
    echo "  cloudflared läuft bereits → wird nicht neu gestartet"
  fi
  docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d postgres redis server client
else
  docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d
fi
echo ""

# ── Cloudflare URL ermitteln ─────────────────────────────────────────────────
echo "── Cloudflare URL ───────────────────────"
echo "  Warte auf Tunnel-URL..."

URL=""
for i in {1..15}; do
  URL=$(docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs cloudflared 2>/dev/null \
    | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' \
    | tail -1 || true)
  if [[ -n "$URL" ]]; then
    break
  fi
  sleep 2
done

ADMIN_TOKEN=$(grep -E 'ADMIN_TOKEN' docker-compose.yml | head -1 | sed 's/.*ADMIN_TOKEN: *//')

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║    voidSector — Zugangsdaten                             ║"
echo "╠══════════════════════════════════════════════════════════╣"
if [[ -n "$URL" ]]; then
  printf "║  URL:          %-43s║\n" "$URL"
else
  printf "║  URL:          %-43s║\n" "(noch nicht verfügbar — siehe unten)"
fi
printf   "║  Admin-Token:  %-43s║\n" "$ADMIN_TOKEN"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Admin-API:  curl -H \"Authorization: Bearer \$TOKEN\" \\   ║"
echo "║              http://localhost:2567/admin/api/stories     ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [[ -z "$URL" ]]; then
  echo ""
  echo "  URL prüfen mit:"
  echo "    docker compose logs cloudflared | grep trycloudflare"
fi

if [[ "$KEEP_TUNNEL" = false ]]; then
  echo ""
  echo "  Tipp: Beim nächsten Deploy --keep-tunnel nutzen"
  echo "  um diese URL zu behalten."
fi

echo ""
echo "── Status ───────────────────────────────"
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
