# Balance-Notizen

## Testphase vs. Produktion

Aktuell sind die Distanzen für Tests reduziert:

### Voids
- `VOID_ORIGIN_EXCLUSION`: **10** (Test) → **100+** (Prod)
- `VOID_SPAWN_MIN_DISTANCE`: **5** (Test) → **50+** (Prod)
- Datei: `packages/server/src/engine/voidLifecycleService.ts`

### Alien-Homeworlds (faction_config)
- Aktuell: 10–30 Quadranten vom Zentrum (gut für Tests)
- Prod: Alle Aliens sollen **weiter weg** starten (50–100+ Quadranten)
- Dadurch mehr Entdeckungs-Gameplay bevor man Aliens trifft
- Einstellbar über Admin-API: `PUT /admin/api/faction-config`

### Alien-Expansion
- Alle Fraktionen sollen in Prod **größer werden dürfen**
- Mehr Quadranten pro Fraktion = interessantere Grenzkonflikte
- Aktuell: Split-Threshold und Max-Cluster-Count begrenzen Wachstum
- `VOID_MIN_CLUSTER_COUNT`: 32 → ggf. erhöhen
- `VOID_MAX_CLUSTER_COUNT`: 48 → ggf. erhöhen
- Faction expansion_rate: pro Fraktion individuell einstellbar

### Frischer Neustart nötig
Die Void-Änderungen greifen nur bei **neuen** Clustern. Bestehende Cluster bleiben an ihren alten Positionen. Für die neuen Test-Distanzen:
```bash
./deploy.sh --fresh
```
