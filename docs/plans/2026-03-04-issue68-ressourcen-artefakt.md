# Issue #68 — Ressourcen: Artefakt-System: Design-Dokument

**Stand:** 2026-03-04
**Branch:** `claude/design-documents-sections-XnGFr`
**Bezug:** Issue #68 „Änderungen an Spielinhalten" — Sektion 3
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

### Ist-Zustand

Es gibt drei Ressourcentypen:

```typescript
export type ResourceType = 'ore' | 'gas' | 'crystal';
```

NPC-Händler kaufen und verkaufen alle drei Ressourcen.
Alle Ressourcen sind handelbar und abbaubar.

### Ziele

1. **Neue Ressource:** `artefact` — extrem selten, nicht NPC-handelbar
2. **Research-Exklusiv:** Artefakte werden nur für Tech-Tree-Forschung verwendet
3. **Kein Abbau:** Keine Abbau-Aktion; nur durch besondere Ereignisse
4. **Nicht verkaufbar:** NPC-Händler lehnen Artefakte ab; kein Marktplatz
5. **Spieler-zu-Spieler-Handel:** Über Fraktions-Tausch oder Data Slate möglich
6. **CRT-Narrativ:** Mysteriöse, außerirdische Ursprünge

---

## 2. Artefakt — Eigenschaften & Herkunft

### 2.1 Definition

```
  ╔════════════════════════════════════════════════════╗
  ║  RESSOURCE: ARTEFAKT                              ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║       ╔═══════╗                                    ║
  ║      ╔╝░░░░░░░╚╗  Außerirdisches Relikt            ║
  ║      ║░▓▓░░▓▓░░║  Unbekannte Technologie           ║
  ║      ║░░░░░░░░░║  Energiesignatur: AKTIV            ║
  ║      ╚╗░░░░░░░╔╝                                   ║
  ║       ╚═══════╝                                    ║
  ║                                                    ║
  ║  Symbol:    ❋ (Radar/Inventar)                     ║
  ║  Farbe:     #FF6B35 (leuchtendes Orange)           ║
  ║  Stapelbar: Ja (max 99 pro Slot)                   ║
  ║  Gewicht:   1 Einheit pro Artefakt                 ║
  ║                                                    ║
  ║  ► NICHT verkaufbar an NPCs                        ║
  ║  ► NICHT abbaubar (keine Mining-Aktion)            ║
  ║  ► NUR für Research-Aktivitäten verwendbar         ║
  ║  ► Spieler-zu-Spieler-Tausch möglich (p2p)        ║
  ╚════════════════════════════════════════════════════╝
```

### 2.2 Herkunft-Quellen

Artefakte können **ausschließlich** durch folgende Ereignisse erlangt werden:

| Quelle                  | Wahrscheinlichkeit | Menge  | Voraussetzung               |
|-------------------------|--------------------|--------|-----------------------------|
| Anomalie-Scan           | 8 %                | 1      | Scanner-Level ≥ 2           |
| Pirate-Beutedrop        | 3 %                | 1      | Pirat besiegt (Kampf v2)    |
| Quest-Belohnung         | Festgelegt         | 1–3    | Spezial-Quest (Tier 3)      |
| Artefakt-Fund (Scan)    | 5 %                | 1      | `ScanEventType: artifact_find` |
| Ancient-Fraktion-Handel | 15 %               | 1      | Reputation: Honored+        |
| Wormhole-Entdeckung     | 10 %               | 1–2    | Ersten Wormhole betreten    |

> **Balance:** Aktive Spieler sammeln ca. 1–3 Artefakte pro Spieltag.
> Ein Tech-Tree-Upgrade benötigt 2–10 Artefakte → spürbare Seltenheit.

---

## 3. Verwendung — Research-System

### 3.1 Artefakt-Verbrauch im Tech-Tree

Artefakte sind die Primärressource für High-End-Forschung.
Sie werden **verbraucht** (nicht zurückerstattet) bei der Forschung.

```
  ╔══════════════════════════════════════════════════════╗
  ║  TECH-RESEARCH: ERWEITERTE SCANMATRIX               ║
  ║  ──────────────────────────────────────────────── ║
  ║                                                      ║
  ║  Forschungs-Kosten:                                  ║
  ║  ► Erz:       150 ██████████░░░░░                   ║
  ║  ► Kristall:   50 ████░░░░░░░░░░░                   ║
  ║  ► ARTEFAKTE:   3 ███░░░░░░░░░░░  [SELTEN]          ║
  ║                                                      ║
  ║  Dauer: 30 Minuten (Echtzeit)                        ║
  ║  Effekt: Scanner-Level +1 (Max: 5)                   ║
  ║                                                      ║
  ║  Dein Inventar:                                      ║
  ║  Erz: 220 ✓   Kristall: 67 ✓   Artefakte: 2 ✗      ║
  ║                                                      ║
  ║  FEHLT: 1 Artefakt                                   ║
  ║  [ABBRECHEN]         [FORSCHUNG STARTEN — GESPERRT] ║
  ╚══════════════════════════════════════════════════════╝
```

### 3.2 Artefakt-Anforderungen nach Tier

Artefakte werden ab **Tech-Tree Tier 2** benötigt.
Tier 1 ist ohne Artefakte erreichbar — Einstiegshürde bleibt niedrig.

| Tech-Tier | Beispiel-Forschung              | Artefakte |
|-----------|----------------------------------|-----------|
| 1         | Mining-Laser MK.II              | 0         |
| 1         | Cargo-Erweiterung MK.II         | 0         |
| 2         | Erweiterte Scanmatrix           | 3         |
| 2         | Schild-Generator MK.II          | 2         |
| 2         | Hyperjump-Optimizer             | 5         |
| 3         | Quantum-Scanner                 | 8         |
| 3         | Ancient-Drive-Integration       | 10        |
| 3         | Nano-Panzerung                  | 15        |

---

## 4. Inventar-Darstellung

### 4.1 Inventar-Eintrag

```
  ╔══ INVENTAR ══════════════════════════════════════╗
  ║                                                  ║
  ║  RESSOURCEN:                                     ║
  ║  ► Erz:        245 ████████████████░░░░░         ║
  ║  ► Gas:         12 █░░░░░░░░░░░░░░░░░░░          ║
  ║  ► Kristall:    88 ████░░░░░░░░░░░░░░░           ║
  ║  ► Artefakte:    2 ❋❋   [SELTEN — NICHT HANDELBAR]║
  ║                                                  ║
  ║  Safe-Slot:  [AKT] Artefakte immer gerettet      ║
  ╚══════════════════════════════════════════════════╝
```

### 4.2 Artefakt-Detail-Ansicht

```
  ╔══ ARTEFAKT — DETAIL ═════════════════════════════╗
  ║                                                  ║
  ║       ╔═══════╗                                  ║
  ║      ╔╝░░░░░░░╚╗                                 ║
  ║      ║░▓▓░░▓▓░░║  ALIEN-RELIKT KLASSE-III        ║
  ║      ║░░░░░░░░░║                                 ║
  ║      ╚╗░░░░░░░╔╝  Herkunft: UNBEKANNT            ║
  ║       ╚═══════╝  Energiesignatur: AKTIV           ║
  ║                                                  ║
  ║  „Ein kompaktes Objekt von außerirdischem        ║
  ║  Ursprung. Seine innere Struktur widersteht      ║
  ║  allen Scan-Versuchen — enthält Technologie      ║
  ║  weit jenseits bekannter Wissenschaft."          ║
  ║                                                  ║
  ║  Verwendung:  ► Forschungs-Projekte (Tech-Tree)  ║
  ║               ► Fraktions-Angebote               ║
  ║  Nicht:       ► NPC-Handel  ► Markt              ║
  ║                                                  ║
  ║  [SCHLIESSEN]                                    ║
  ╚══════════════════════════════════════════════════╝
```

---

## 5. Artefakt & Safe Slots

Artefakte sind **immer** im Safe-Slot geschützt — sie gehen beim Schiffsverlust
**nicht** verloren, unabhängig vom aktuellen Safe-Slot-Level:

```
  Safe-Slot-Regeln:
  ┌──────────────────────────────────────────────────┐
  │  Schiff zerstört → Ressourcen-Verlust:            │
  │                                                   │
  │  Artefakte:   IMMER gerettet (garantiert)         │
  │  Erz/Gas/Kristall: Nur Safe-Slot-Menge gerettet   │
  │                                                   │
  │  Begründung: Artefakte sind zu selten und         │
  │  wertvoll, um durch Tod komplett verloren          │
  │  zu gehen — das würde Frustration erzeugen.        │
  └──────────────────────────────────────────────────┘
```

---

## 6. Scan-Events mit Artefakt-Drop

Erweiterung des bestehenden `ScanEventType`:

### 6.1 Bestehender Flow

```
artifact_find → Scan-Event → CRT-Nachricht → +Ressourcen
```

### 6.2 Erweiterter Flow mit Artefakt

```
artifact_find → Scan-Event → CRT-Nachricht → 50 % Chance: +Kristall | 50 % Chance: +Artefakt

anomaly_reading → Scan-Event → CRT-Nachricht → 8 % Chance: +Artefakt (zusätzlich zu normaler Beute)
```

**CRT-Scan-Nachricht (Artefakt-Fund):**

```
  ╔══ SCAN-ERGEBNIS: ANOMALIE ═══════════════════════╗
  ║                                                  ║
  ║  ► Anomalie-Typ: GRAVITATIONSVERZERRUNG          ║
  ║  ► Signatur-Analyse: ABGESCHLOSSEN               ║
  ║                                                  ║
  ║  !! UNBEKANNTES OBJEKT DETEKTIERT !!             ║
  ║                                                  ║
  ║  Dichte-Anomalie im Zentrum des Sektors.         ║
  ║  Energiemuster entsprechen keiner bekannten      ║
  ║  Technologie. Objekt geborgen.                   ║
  ║                                                  ║
  ║  BEUTE: +1 ARTEFAKT ❋                            ║
  ║                                                  ║
  ║  [SCHLIESSEN]                                    ║
  ╚══════════════════════════════════════════════════╝
```

---

## 7. NPC-Ablehnung

Wenn der Spieler versucht, Artefakte an NPCs zu verkaufen:

```
  ╔══ HANDEL — FEHLER ════════════════════════════════╗
  ║                                                   ║
  ║  NPC: „Diese Objekte sind für mich wertlos —      ║
  ║  oder vielleicht unbezahlbar. Kein Händler        ║
  ║  würde das anfassen. Versuch es woanders."        ║
  ║                                                   ║
  ║  ARTEFAKTE können nicht an NPCs verkauft werden.  ║
  ║  Verwende sie im Tech-Baum oder tausche sie       ║
  ║  mit anderen Spielern.                            ║
  ║                                                   ║
  ║  [OK]                                             ║
  ╚═══════════════════════════════════════════════════╝
```

---

## 8. Spieler-zu-Spieler-Tausch

Artefakte können **zwischen Spielern** transferiert werden:

| Methode                  | Verfügbarkeit          | Limit        |
|--------------------------|------------------------|--------------|
| Fraktions-Chat-Tausch    | Beide in gleicher Fraktion | Kein Limit |
| Data-Slate-Handel        | Marktplatz (p2p)       | 1–99 Stück   |
| Direkt-Transfer (Station)| Beide an gleicher Station | Kein Limit |

---

## 9. Technische Implementierung

### 9.1 Typen-Erweiterung (`packages/shared/src/types.ts`)

```typescript
// Artefakt als neue Ressource
export type ResourceType = 'ore' | 'gas' | 'crystal' | 'artefact';

// Artefakt-Eigenschaften
export interface ResourceDefinition {
  id: ResourceType;
  label: string;
  symbol: string;
  color: string;
  npcTradeable: boolean;      // false für artefact
  alwaysSafeSlot: boolean;    // true für artefact
  maxStack: number;
}
```

### 9.2 Konstanten (`packages/shared/src/constants.ts`)

```typescript
// Ressource-Definitionen
export const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition> = {
  ore:      { id: 'ore',      label: 'Erz',      symbol: '◆', color: '#FFB000', npcTradeable: true,  alwaysSafeSlot: false, maxStack: 999 },
  gas:      { id: 'gas',      label: 'Gas',       symbol: '○', color: '#00BFFF', npcTradeable: true,  alwaysSafeSlot: false, maxStack: 999 },
  crystal:  { id: 'crystal',  label: 'Kristall',  symbol: '✦', color: '#B06BFF', npcTradeable: true,  alwaysSafeSlot: false, maxStack: 999 },
  artefact: { id: 'artefact', label: 'Artefakt',  symbol: '❋', color: '#FF6B35', npcTradeable: false, alwaysSafeSlot: true,  maxStack: 99  },
};

// Artefakt-Drop-Wahrscheinlichkeiten
export const ARTEFACT_DROP_CHANCES = {
  anomaly_scan:         0.08,   // 8 %
  artifact_find_event:  0.50,   // 50 % (andere 50 % = Kristall)
  pirate_loot:          0.03,   // 3 %
  wormhole_first:       0.10,   // 10 % (erstes Mal)
  ancient_faction_trade: 0.15,  // 15 % bei Honored+
};

// NPC-Preise: artefact NICHT in NPC_PRICES (kein Handel)
export const NPC_PRICES: Record<Exclude<ResourceType, 'artefact'>, number> = {
  ore: 5, gas: 8, crystal: 15,
};

// Research-Artefakt-Kosten (Tier 2+)
export const RESEARCH_ARTEFACT_COSTS: Record<string, number> = {
  scanner_advanced:     3,
  shield_mk2:           2,
  hyperjump_optimizer:  5,
  quantum_scanner:      8,
  ancient_drive:        10,
  nano_armor:           15,
};
```

### 9.3 Server-Logik

**Artefakt-Safe-Slot in Schiffsverlust-Handler:**

```typescript
// In handleShipDestroyed():
function calculateSurvivedResources(inventory: Inventory, safeSlotLevel: number): Inventory {
  const survived: Inventory = {};
  for (const [res, amount] of Object.entries(inventory)) {
    if (res === 'artefact') {
      survived[res] = amount;  // IMMER gerettet
    } else {
      const maxSafe = SAFE_SLOT_CAPACITY[safeSlotLevel];
      survived[res] = Math.min(amount, maxSafe);
    }
  }
  return survived;
}
```

**NPC-Handel-Prüfung:**

```typescript
// In handleSellResource():
if (resource === 'artefact') {
  return { success: false, error: 'ARTEFACT_NOT_NPC_TRADEABLE' };
}
```

**Artefakt-Drop in Scan-Events:**

```typescript
// In generateScanEvent():
case 'artifact_find': {
  const roll = Math.random();
  if (roll < ARTEFACT_DROP_CHANCES.artifact_find_event) {
    rewards.push({ type: 'artefact', amount: 1 });
  } else {
    rewards.push({ type: 'crystal', amount: Math.floor(Math.random() * 5) + 2 });
  }
  break;
}
case 'anomaly_reading': {
  const roll = Math.random();
  if (roll < ARTEFACT_DROP_CHANCES.anomaly_scan) {
    rewards.push({ type: 'artefact', amount: 1 });
  }
  // ... normale Anomalie-Belohnungen zusätzlich
  break;
}
```

### 9.4 DB-Änderungen

Keine Schema-Änderungen nötig — Inventar wird als JSONB gespeichert:
```json
{ "ore": 245, "gas": 12, "crystal": 88, "artefact": 2 }
```

Das neue Feld `artefact` wird automatisch unterstützt.

### 9.5 Client-Änderungen

**Inventar-Anzeige (`packages/client/src/components/`):**
- `InventoryPanel.tsx`: Artefakte mit `❋`-Symbol + Orange-Farbe anzeigen
- `ResourceBar.tsx`: Artefakt-Zeile nur anzeigen wenn `artefact > 0`
- Tooltip: „ARTEFAKT — Nur für Forschung verwendbar"

**Handel-Sperre (`TradePanel.tsx`):**
- Artefakt aus der verkaufbaren Ressourcenliste ausschließen
- Fehlermeldung bei Versuch: NPC-Dialog-Nachricht

---

## 10. Phasen-Plan

### Phase 1 — Basis-Integration (0.5 Tage)

- [ ] `ResourceType` um `'artefact'` erweitern
- [ ] `RESOURCE_DEFINITIONS` Konstante anlegen
- [ ] `NPC_PRICES` für `artefact` ausschließen
- [ ] Tests: Typ-Checks, NPC-Handel-Sperre

### Phase 2 — Drop-Mechanik (1 Tag)

- [ ] Scan-Event-Handler: Artefakt-Drop-Wahrscheinlichkeit
- [ ] Pirate-Loot: Artefakt-Drop (3 %)
- [ ] Ancient-Faction-Handel: Artefakt-Belohnung
- [ ] Safe-Slot-Handler: Artefakt immer retten
- [ ] Tests: Drop-Wahrscheinlichkeiten, Safe-Slot

### Phase 3 — UI (0.5 Tage)

- [ ] Inventar-Panel: Artefakt-Zeile (Symbol + Farbe)
- [ ] Handel-Panel: Artefakt-Ausschluss + NPC-Dialog
- [ ] Artefakt-Detail-Overlay
- [ ] Scan-Event-Nachrichten: Artefakt-Texte

### Phase 4 — Research-Integration (mit Tech-Tree-Dokument)

- [ ] Artefakt-Kosten in Research-Projekte einbauen
- [ ] Forschungs-UI: Artefakt-Anforderung anzeigen
- [ ] Fehlermeldung: „Nicht genug Artefakte"

---

*Dokument-Ende — voidSector Issue #68 / Sektion 3: Ressourcen — Artefakt*
