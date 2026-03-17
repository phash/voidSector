# NPC Trade Dialog — Design Spec

**Datum:** 2026-03-17
**Issue:** #488 (Trade Interface)

## Ziel

Eigener Trade-Dialog für NPC-Schiffe (Trader/Outlaws) im Hauptmonitor. Spieler kann Ressourcen kaufen/verkaufen mit dynamischen Preisen (Angebot/Nachfrage). Outlaws bieten zusätzlich Artefakte an.

## Trigger

- Spieler klickt [HANDELN] bei einem NPC-Trader oder NPC-Outlaw im Detail-Panel
- Hauptmonitor (Sec 2) wechselt zum NPC-Trade-View
- [ZURÜCK] / ESC → zurück zum Radar

## Layout

```
┌─────────────────────────────────────────┐
│ HANDEL — Händler Axmor-1 [TRADER]       │
├─────────────────────────────────────────┤
│                                         │
│  ── KAUFEN (vom NPC) ──                 │
│  ORE    ×12   8CR/St  [-][===][+] [BUY] │
│  GAS    ×5    15CR/St [-][===][+] [BUY] │
│  CRYSTAL ×0   ---     (ausverkauft)     │
│                                         │
│  ── VERKAUFEN (an NPC) ──               │
│  ORE    ×10   6CR/St  [-][===][+] [SELL]│
│  GAS    ×5    10CR/St [-][===][+] [SELL]│
│  CRYSTAL ×3   16CR/St [-][===][+] [SELL]│
│                                         │
│  ── ARTEFAKTE (nur Outlaws) ──          │
│  Drive Artefakt    50CR  [KAUFEN]       │
│  Scanner Artefakt  80CR  [KAUFEN]       │
│                                         │
├─────────────────────────────────────────┤
│ CR: 4.250  │  NPC: ORE:12 GAS:5 CRY:0  │
│                           [ZURÜCK]      │
└─────────────────────────────────────────┘
```

## Preismechanik (Angebot/Nachfrage)

**Kaufpreis** (Spieler kauft vom NPC):
```
buyPrice = basePrice × (1 + (capacity - stock) / capacity)
```
- Wenig Vorrat → teurer (bis 2× Basispreis)
- Voller Vorrat → Basispreis
- Ausverkauft (stock=0) → nicht kaufbar

**Verkaufpreis** (Spieler verkauft an NPC):
```
sellPrice = basePrice × 0.6 × (1 - stock / capacity)
```
- NPC hat wenig → zahlt mehr
- NPC hat viel → zahlt weniger
- Outlaw-Discount (0.8×) auf alle Preise

**Basis-Preise:** ore=8, gas=12, crystal=20 (aus `NPC_TRADE_BASE_PRICES`)
**NPC Kapazität:** 100 (aus `NPC_TRADE_CAPACITY`)

## Artefakte (nur Outlaws)

- Outlaws haben 1-3 zufällige Artefakte im Inventar
- Artefakt-Typen: drive, cargo, scanner, armor, weapon, shield, mining, generator
- Preis: 50-100 CR je nach Typ
- Einmalig kaufbar (verschwindet aus NPC-Inventar)
- Chance auf Artefakt: `NPC_OUTLAW_ARTEFACT_CHANCE` (0.3)

## Neue Dateien

| Datei | Zweck |
|-------|-------|
| `packages/client/src/components/NpcTradeView.tsx` | Trade-UI-Komponente |

## Modifizierte Dateien

| Datei | Änderung |
|-------|----------|
| `packages/client/src/components/DetailPanel.tsx` | [HANDELN] öffnet NpcTradeView statt TRADE-Programm |
| `packages/client/src/components/CockpitLayout.tsx` | NpcTradeView im Hauptmonitor rendern |
| `packages/client/src/state/gameSlice.ts` | `npcTradeOpen: { npcId: number } | null` State |
| `packages/client/src/network/client.ts` | Handler für Trade-Responses |
| `packages/server/src/rooms/services/NpcShipService.ts` | Dynamische Preisberechnung, Artefakt-Handel |
| `packages/shared/src/constants.ts` | Preis-Formel-Konstanten falls nötig |

## Zustandssteuerung

- `npcTradeOpen: { npcId: number } | null` in gameSlice
- [HANDELN] → `setState({ npcTradeOpen: { npcId } })`
- [ZURÜCK] / ESC / Trade abgeschlossen → `setState({ npcTradeOpen: null })`
- CockpitLayout: wenn `npcTradeOpen` → zeige `<NpcTradeView />` statt Radar

## Server-Änderungen

- `handleNpcShipTrade`: Preisberechnung nach Angebot/Nachfrage-Formel
- Neuer Message-Typ: `getNpcTradeInfo` → liefert NPC-Inventar + berechnete Preise
- Response: `{ npcId, name, role, inventory, prices: { ore: { buy, sell }, ... }, artefacts: [...] }`
