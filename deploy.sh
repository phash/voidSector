#!/usr/bin/env bash
set -euo pipefail

# Ensure node/npm are in PATH (nvm, fnm, or system install)
export PATH="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | tail -1)/bin:$HOME/.local/share/fnm/aliases/default/bin:/usr/local/bin:/usr/bin:$PATH"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# deploy.sh — voidSector Testrechner-Deployment
#
# Optionen:
#   --new-tunnel     Cloudflared-Container (neu) starten (neue Tunnel-URL)
#   --branch <name>  Branch auschecken vor dem Deploy (Standard: aktueller Branch)
#   --no-pull        Kein git pull
#   --fresh          Frischer Neustart: DB löschen, alles neu aufsetzen
#   --balance <file> Balance-Snapshot nach Neustart importieren

NEW_TUNNEL=false
BRANCH=""
NO_PULL=false
NO_CACHE=false
FRESH=false
BALANCE_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --new-tunnel) NEW_TUNNEL=true; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --no-pull) NO_PULL=true; shift ;;
    --no-cache) NO_CACHE=true; shift ;;
    --fresh) FRESH=true; shift ;;
    --balance) BALANCE_FILE="$2"; shift 2 ;;
    --help|-h)
      echo "Verwendung: $0 [OPTIONEN]"
      echo ""
      echo "Optionen:"
      echo "  --new-tunnel       Cloudflare-Tunnel (neu) starten (neue URL)"
      echo "  --branch <name>    Branch vor dem Deploy auschecken"
      echo "  --no-pull          Kein git pull"
      echo "  --no-cache         Docker Build ohne Cache"
      echo "  --fresh            DB komplett löschen und neu aufsetzen"
      echo "  --balance <file>   Balance-Snapshot nach Start importieren"
      echo "  --help, -h         Diese Hilfe anzeigen"
      echo ""
      echo "Beispiele:"
      echo "  ./deploy.sh                                    # normaler Deploy (lokal)"
      echo "  ./deploy.sh --new-tunnel                       # Deploy + neuen Tunnel starten"
      echo "  ./deploy.sh --branch feat/xyz                  # bestimmten Branch deployen"
      echo "  ./deploy.sh --fresh                            # Frischer Neustart (DB reset)"
      echo "  ./deploy.sh --fresh --balance snapshot.json    # Neustart + Balance importieren"
      echo "  ./deploy.sh --no-cache                         # ohne Docker-Cache neu bauen"
      exit 0
      ;;
    *) echo "Unbekannte Option: $1"; echo "Hilfe: $0 --help"; exit 1 ;;
  esac
done

echo "── voidSector Deploy ────────────────────"
echo "  new-tunnel  : $NEW_TUNNEL"
echo "  no-cache    : $NO_CACHE"
echo "  fresh       : $FRESH"
[[ -n "$BRANCH" ]] && echo "  branch      : $BRANCH"
[[ -n "$BALANCE_FILE" ]] && echo "  balance     : $BALANCE_FILE"
echo ""

# ── Fresh Reset ──────────────────────────────────────────────────────────────
if [[ "$FRESH" = true ]]; then
  echo "── Fresh Reset ──────────────────────────"

  # Export current balance before destroying DB
  if docker compose ps server --status running 2>/dev/null | grep -q "running"; then
    echo "  Exportiere aktuellen Balance-Stand..."
    BACKUP_FILE="balance-backup-pre-fresh-$(date +%Y%m%d-%H%M%S).json"
    npx tsx "$SCRIPT_DIR/scripts/balance-export.ts" -- -o "$BACKUP_FILE" 2>/dev/null && \
      echo "  Backup: $BACKUP_FILE" || \
      echo "  (kein Backup möglich — Server nicht erreichbar)"
  fi

  echo "  Stoppe Services (Tunnel bleibt)..."
  docker compose stop server client postgres redis
  docker compose rm -f server client postgres redis
  docker volume rm voidsector_postgres-data 2>/dev/null || true
  echo "  DB-Volume gelöscht. Frischer Start."
  echo ""
fi

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
if [[ "$NO_CACHE" = true ]]; then
  echo "  (ohne Cache)"
  docker compose build --no-cache server client
else
  docker compose build server client
fi
echo ""

# ── Start / Restart ──────────────────────────────────────────────────────────
echo "── Services starten ─────────────────────"
docker compose up -d postgres redis server client
if [[ "$NEW_TUNNEL" = true ]]; then
  echo "  Starte neuen Cloudflare-Tunnel..."
  docker compose up -d --force-recreate cloudflared
elif docker compose ps cloudflared --status running 2>/dev/null | grep -q "running"; then
  echo "  Tunnel läuft bereits."
else
  # Tunnel existiert aber läuft nicht (z.B. nach fresh) → starten
  echo "  Starte Cloudflare-Tunnel..."
  docker compose up -d cloudflared
fi
echo ""

# ── Cloudflare URL ermitteln ─────────────────────────────────────────────────
URL=""
if [[ "$NEW_TUNNEL" = true ]] || docker compose ps cloudflared --status running 2>/dev/null | grep -q "running"; then
  echo "── Cloudflare URL ───────────────────────"
  echo "  Warte auf Tunnel-URL..."
  for i in {1..15}; do
    URL=$(docker compose logs cloudflared 2>/dev/null \
      | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' \
      | tail -1 || true)
    if [[ -n "$URL" ]]; then
      break
    fi
    sleep 2
  done
fi

ADMIN_TOKEN=$(awk -F': ' '/ADMIN_TOKEN/{gsub(/[[:space:]]/, "", $2); print $2}' docker-compose.yml | head -1)
ADMIN_BASE="${URL:-http://localhost:3201}"

# Write current deployment info to current.md
cat > "$SCRIPT_DIR/current.md" <<CURRENT
# voidSector — Current Deployment

- **URL**: ${URL:-http://localhost:3201}
- **Admin API**: ${ADMIN_BASE}/admin/api
- **Admin Token**: ${ADMIN_TOKEN}
- **Branch**: $(git branch --show-current) @ $(git log --oneline -1)
- **Deployed**: $(date '+%Y-%m-%d %H:%M:%S')
CURRENT

echo ""
echo "── Zugangsdaten ─────────────────────────"
if [[ -n "$URL" ]]; then
  echo "  URL:         $URL"
else
  echo "  URL:         (noch nicht verfügbar)"
  echo "               docker compose logs cloudflared | grep trycloudflare"
fi
echo "  Admin-Token: $ADMIN_TOKEN"
echo "  Admin-API:   $ADMIN_BASE/admin/api/stories"
if [[ -z "$URL" ]]; then
  echo "  Tipp: --new-tunnel um einen Cloudflare-Tunnel zu starten"
fi

# ── Balance Import ──────────────────────────────────────────────────────────
if [[ -n "$BALANCE_FILE" ]]; then
  echo ""
  echo "── Balance Import ───────────────────────"
  if [[ ! -f "$BALANCE_FILE" ]]; then
    echo "  FEHLER: $BALANCE_FILE nicht gefunden!"
  else
    echo "  Warte auf Server-Start..."
    for i in {1..20}; do
      if curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:2567/admin/api/config" >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
    echo "  Importiere $BALANCE_FILE..."
    npx tsx "$SCRIPT_DIR/scripts/balance-import.ts" -- "$BALANCE_FILE" 2>&1 | tail -5
  fi
fi

# ── Balance Snapshot → GitHub Issue ────────────────────────────────────────
echo ""
echo "── Balance Snapshot ─────────────────────"
echo "  Warte auf Server..."
for i in {1..10}; do
  if curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:2567/admin/api/config" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

SNAPSHOT_FILE="balance-snapshot-$(date +%Y%m%d-%H%M%S).json"
npx tsx "$SCRIPT_DIR/scripts/balance-export.ts" -- -o "$SNAPSHOT_FILE" 2>&1 | tail -3

if command -v gh &>/dev/null; then
  echo "  Erstelle GitHub Issue mit Balance-Daten..."

  # Build issue body from snapshot
  ISSUE_BODY="# Balance Snapshot $(date +%Y-%m-%d)

> Auto-generated by deploy.sh $(if [[ "$FRESH" = true ]]; then echo '(fresh reset)'; fi)
> Branch: $(git branch --show-current) @ $(git log --oneline -1)

## Faction Config

| Faction | Home | Exp.Rate | Aggression | Style |
|---------|------|----------|------------|-------|"

  # Parse faction config from JSON
  if command -v python3 &>/dev/null; then
    FACTION_TABLE=$(python3 -c "
import json, sys
d = json.load(open('$SNAPSHOT_FILE'))
for fid, fc in sorted(d.get('factionConfig', {}).items()):
    print(f\"| {fid} | ({fc['home_qx']},{fc['home_qy']}) | {fc['expansion_rate']} | {fc['aggression']} | {fc['expansion_style']} |\")
")
    ISSUE_BODY="$ISSUE_BODY
$FACTION_TABLE"
  fi

  ISSUE_BODY="$ISSUE_BODY

## Key Balance Values

<details>
<summary>Full snapshot (click to expand)</summary>

\`\`\`json
$(cat "$SNAPSHOT_FILE")
\`\`\`

</details>
"

  ISSUE_TMPFILE=$(mktemp)
  echo "$ISSUE_BODY" > "$ISSUE_TMPFILE"
  ISSUE_URL=$(gh issue create \
    --title "balance: snapshot $(date +%Y-%m-%d)$(if [[ "$FRESH" = true ]]; then echo ' (fresh)'; fi)" \
    --body-file "$ISSUE_TMPFILE" \
    --label "balance" 2>/dev/null || echo "")
  rm -f "$ISSUE_TMPFILE"

  if [[ -n "$ISSUE_URL" ]]; then
    echo "  Issue: $ISSUE_URL"
  else
    echo "  (GitHub Issue konnte nicht erstellt werden — gh CLI nicht konfiguriert?)"
    echo "  Snapshot liegt in: $SNAPSHOT_FILE"
  fi
else
  echo "  gh CLI nicht installiert — kein Issue erstellt"
  echo "  Snapshot liegt in: $SNAPSHOT_FILE"
fi

echo ""
echo "── Status ───────────────────────────────"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
