# Scan-to-Slate — Design Spec

## Ziel

Nach einem LOCAL SCAN kann der Spieler das Scan-Ergebnis als Data Slate speichern. Der Slate enthält alle Scan-Daten plus Kontext (Quadrant, Sektor, Typ, Strukturen, Universe Tick).

## Anforderungen

- **[SAVE TO SLATE]** Button im Scan-Ergebnis-Popup, links neben [SCHLIESSEN]
- Kostenlos (Scan hat schon AP gekostet), braucht aber 1 Cargo-Slot
- Ein Klick, keine Bestätigung
- Nur 1 Slate pro Scan — Button wird nach Klick disabled ("✓ SLATE GESPEICHERT")
- Cargo voll → Button disabled ("CARGO VOLL")
- Slates erscheinen im CARGO-Screen, klickbar → Detail-Panel zeigt Slate-Infos

## Architektur

### 1. Server — erweiterte Scan-Daten

`ScanService.handleLocalScan` erweitert die `localScanResult`-Message um:

```typescript
// bestehende Felder:
resources: { ore, gas, crystal }
hiddenSignatures: boolean
wrecks: [...]

// NEU:
sectorX: number
sectorY: number
quadrantX: number
quadrantY: number
sectorType: string          // 'empty' | 'station' | 'nebula' | ...
structures: string[]        // ['npc_station'] | ['jumpgate'] | []
universeTick: number        // getUniverseTickCount()
```

`structures` wird aus dem Sektor abgeleitet:
- Sektortyp `'station'` → `['npc_station']`
- `getPlayerJumpGate(x, y)` findet Jumpgate → `['jumpgate']`
- `sectorData?.contents?.includes('ruin')` → `['ruin']`
- Sonst `[]`

**Hinweis:** `getUniverseTickCount()` muss in ScanService importiert werden (aus `engine/universeBootstrap.ts`).

### 2. Server — neuer Handler `createSlateFromScan`

Neuer Message-Handler in `WorldService` (dort liegen alle Slate-CRUD-Operationen):

**Message:** `'createSlateFromScan'`
**Data:** Der Server baut die Slate-Daten selbst aus dem aktuellen Spieler-Sektor (kein Trust auf Client-Daten). Der Client sendet nur ein leeres Signal.

**Flow:**
1. Spielerposition + Sektor-Daten laden (aus `playerSectorData` Map + `getSector()`)
2. Cargo-Platz prüfen: `cargoTotal + 1 ≤ cargoCap` → sonst Fehler
3. `structures` ableiten:
   - `sectorType === 'station'` → `['npc_station']`
   - `getPlayerJumpGate(sectorX, sectorY)` → falls vorhanden: `['jumpgate']` hinzufügen
   - `sectorData?.contents?.includes('ruin')` → falls vorhanden: `['ruin']` hinzufügen
4. `sector_data` JSONB bauen:
   ```json
   [{
     "x": 16, "y": 14,
     "quadrantX": 0, "quadrantY": 0,
     "type": "station",
     "ore": 42, "gas": 18, "crystal": 7,
     "structures": ["npc_station"],
     "wrecks": [{ "playerName": "xPilot42", "tier": 2 }],
     "scannedAtTick": 48720
   }]
   ```
   Wreck-Daten werden reduziert auf `{ playerName, tier }` (kein `radarIconData` etc.).
5. `createDataSlate(playerId, 'scan', sectorData)` — neuer SlateType `'scan'`
6. `addSlateToCargo(playerId)` — schreibt in `cargo`-Tabelle (wie bestehende Slate-Handler)
7. Antwort via bestehendes `cargoUpdate`-Broadcast + dedizierte `slateFromScanResult`-Message:
   `{ success: true }` bzw. `{ success: false, error: 'CARGO_FULL' }`

### 3. Shared — SlateType erweitern

`types.ts` SlateType um `'scan'` erweitern:
```typescript
export type SlateType = 'sector' | 'area' | 'custom' | 'jumpgate' | 'scan';
```

DB `data_slates.slate_type` CHECK constraint erweitern (Migration).

### 4. Client — Scan-Popup erweitern

`LocalScanResultOverlay.tsx`:

**Store-State erweitern:** `localScanResult` bekommt die neuen Felder (`sectorX`, `sectorY`, `quadrantX`, `quadrantY`, `sectorType`, `structures`, `universeTick`).

**Neue UI-Elemente:**
- Quadrant + Sektor-Koordinaten (2-spaltig, oben)
- Sektortyp + Strukturen (2-spaltig)
- Universe Tick im Header rechts ("LOCAL SCAN · TICK 48720")
- [SAVE TO SLATE] Button links unten

**Button-States:**
- **Normal:** `[SAVE TO SLATE]` — cyan (`#00BFFF`), klickbar
- **Gespeichert:** `✓ SLATE GESPEICHERT` — grün (`#4a9`), disabled
- **Cargo voll:** `[SLATE] CARGO VOLL` — rot/grau, disabled

**Logik:**
- `useState<boolean>` für `slateSaved`
- Klick → `network.sendCreateSlateFromScan()` → bei Erfolg `slateSaved = true`
- Cargo-Check: Client prüft vorab ob Platz ist (aus Store: `cargoTotal < cargoCap`)

### 5. Client — CARGO Detail-Panel für Slates

Im CARGO-Screen (`CargoScreen.tsx`):
- Slates werden in der Cargo-Liste angezeigt (bestehendes System — Slates sind ein Cargo-Typ)
- Klick auf einen Slate → bestehender `getPlayerSlates()`-Call liefert alle Slates mit `slate_type`
- Für Slates mit `slate_type === 'scan'` zeigt das Detail-Panel (Sec 3):
  - Header: "SCAN SLATE · TICK {scannedAtTick}"
  - Quadrant + Sektor-Koordinaten (aus `sector_data[0]`)
  - Sektortyp
  - Ressourcen (Ore/Gas/Crystal)
  - Strukturen
  - Wracks (playerName + tier)
- Bestehende Aktionen bleiben: [AKT] (aktivieren), [NPC] (verkaufen)

**Duplikat-Schutz:** Nur client-seitig (`slateSaved`-State). Server akzeptiert mehrere Slates pro Sektor — kostet jeweils 1 Cargo-Slot, daher selbstlimitierend.

### 6. Network

Neuer Client-zu-Server Message:
```typescript
sendCreateSlateFromScan(): void {
  this.sectorRoom?.send('createSlateFromScan', {});
}
```

Server-zu-Client Responses:
```typescript
// 1. Dedizierte Antwort für Button-State
room.onMessage('slateFromScanResult', (data: { success: boolean; error?: string }) => {
  // slateSaved = true bei success
});

// 2. Cargo-Update via bestehendes cargoUpdate-Broadcast (automatisch)
// → Client-Store aktualisiert Cargo-State wie bei allen anderen Slate-Operationen
```

### 7. Migration (057_scan_slate_type.sql)

```sql
-- Erweitere slate_type CHECK constraint um 'scan' (idempotent)
DO $$
BEGIN
  ALTER TABLE data_slates DROP CONSTRAINT IF EXISTS data_slates_slate_type_check;
  ALTER TABLE data_slates ADD CONSTRAINT data_slates_slate_type_check
    CHECK (slate_type IN ('sector', 'area', 'custom', 'jumpgate', 'scan'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

**Hinweis:** Nach Änderung an `packages/shared/src/types.ts` muss `cd packages/shared && npm run build` ausgeführt werden.

## Nicht im Scope

- Keine AP-Kosten für den Slate (Scan hat schon AP gekostet)
- Keine Bestätigungsdialoge
- Kein Marketplace-Listing für Scan-Slates (nutzt bestehendes System)
- Keine Änderungen am Area-Scan
