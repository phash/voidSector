# Technische Spezifikationen

## 1. Tech-Stack (Empfehlung)
* **Frontend:** React oder Vue.js (SPA).
* **Rendering Karte:** PixiJS (für performantes 2D-Grid).
* **Backend:** Node.js (Express oder Fastify).
* **Datenbank:** PostgreSQL (Spieler, Basen, Inventar) + Redis (AP-Regeneration/Echtzeit-Ticks).

## 2. Datenstrukturen (Beispiele)

### Sektor-Objekt
```json
{
  "coords": {"x": 105, "y": -22},
  "type": "nebula|asteroid_field|empty|station",
  "resources": [{"type": "iron", "amount": 500, "level": 1}],
  "discovered_by": "PlayerID",
  "faction_claim": "FactionID"
}