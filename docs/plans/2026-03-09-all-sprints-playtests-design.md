# All-Sprints Execution + Live Playtests — Design

**Datum:** 2026-03-09
**Branch:** fix/quality-sprint

## Ziel

Alle verbleibenden Sprints aus dem Master-Roadmap durcharbeiten, nach jedem Sprint committen, danach zwei live Playtests mit echtem Docker-Backend.

## Ausführungsreihenfolge

| Sprint | Issues | Plan |
|--------|--------|------|
| S3 | #140, #141, #157 | Master-Roadmap inline |
| S4 | #159, #146, #149 | Master-Roadmap inline |
| P2 | #163–168 | `2026-03-06-restructuring-plan-sector-system.md` |
| LU | #178–184 | `2026-03-09-lebendiges-universum.md` |
| D  | #169   | `2026-03-07-drone-idle-automation-system.md` |
| AQ | #171–175 | `2026-03-07-quest-alien-system.md` |

Commit nach jedem Sprint mit `feat: <sprint>-Beschreibung, closes #XXX`.

## Playtests (nach allen Sprints)

**Infrastruktur:** Docker Desktop läuft. Server (Port 2567) + Client (Port 3201) werden gestartet. Playwright verbindet sich mit echter WebSocket-Verbindung.

**Playtest 1 — Admin / Universe Growth:**
- Login als Admin (ADMIN_TOKEN: `voidsector-admin-dev`)
- Admin-Console + LU-Tick-Engine + Territory-Stats beobachten
- Screenshots: `docs/screenshots/playtests/admin/01-*.png` etc.
- Story via `/playtest` Skill + Admin-API

**Playtest 2 — User / New Player Journey:**
- Spawn → Herumfliegen → Asteroid abbauen → Station verkaufen → Quadrant wechseln → wiederholen → Quest abschließen → Schiff upgraden
- Screenshots: `docs/screenshots/playtests/user/01-*.png` etc.
- Story via `/playtest` Skill + Admin-API

**Ausführung:** `/playtest` Skill für beide Szenarien.

## Referenz-Plan

Vollständiger Implementierungsplan: `docs/plans/2026-03-09-master-roadmap.md`
