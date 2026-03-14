# Blueprint-Herstellung aus ACEP/Tech-Tree

**Datum:** 2026-03-14
**Status:** Draft
**Issue:** TBD

## Zusammenfassung

Spieler, die ein Modul im Tech-Tree erforschen, erhalten den ersten Blueprint automatisch gratis. Weitere Kopien koennen im Tech-Tree hergestellt werden (100 CR × Tier). Blueprints sind handelbare Items im unified item system.

## Aktueller Zustand

- Blueprints droppen aus Scan-Events (`blueprint_find`, 10%) und Wrack-Bergung (Tier 2+)
- `handleActivateBlueprint` konsumiert Blueprint und schaltet Modul frei
- `handleCraftModule` stellt Modul aus freigeschaltetem Rezept her (Ressourcen + Credits)
- Tech-Tree-Forschung (`researchTechNode`) schaltet Module frei, gibt aber keinen Blueprint

## Design

### Flow

```
Spieler erforscht Modul im Tech-Tree
    |
    v
Forschung abgeschlossen
    |
    v
Erster Blueprint landet automatisch im Inventar (gratis)
    |
    v
Spieler kann jederzeit weitere Kopien herstellen:
    Tech-Tree -> Modul auswaehlen -> [BLUEPRINT HERSTELLEN]
    Kosten: 100 CR x Tier
    |
    v
Blueprint im Inventar (itemType: 'blueprint', itemId: moduleId)
    -> Selbst nutzen (FABRIK)
    -> Verkaufen (Handel/Auktionshaus)
    -> Tauschen (Alien-Fraktionen)
```

### Kosten

| Tier | Blueprint-Kopie |
|------|----------------|
| 1 | 100 CR |
| 2 | 200 CR |
| 3 | 300 CR |
| 4 | 400 CR |
| 5 | 500 CR |

Formel: `BLUEPRINT_COPY_COST = 100 * tier`

Erster Blueprint bei Forschungsabschluss: kostenlos.

### Bedingungen

- Modul muss im Tech-Tree erforscht sein (`unlockedModules` enthaelt moduleId)
- Spieler muss genug Credits haben
- Keine Mengenbegrenzung fuer Kopien
- Blueprint-Herstellung ist sofort (keine Wartezeit)

## Aenderungen

### 1. Shared — Constants

Neue Konstante in `constants.ts`:

```typescript
export const BLUEPRINT_COPY_BASE_COST = 100; // CR pro Tier
```

### 2. Server — TechTreeService

Bei Abschluss von `researchTechNode`: Wenn der Node ein Modul freischaltet, automatisch Blueprint ins Inventar legen.

```
researchTechNode(nodeId)
  -> Node als erforscht markieren
  -> Falls Node ein Modul freischaltet:
     addToInventory(userId, 'blueprint', moduleId, 1)
     client.send('logEntry', 'BLUEPRINT ERHALTEN: ...')
     client.send('inventoryUpdated')
```

### 3. Server — ShipService (neuer Handler)

Neuer Handler `handleCreateBlueprintCopy(client, { moduleId })`:

```
1. Pruefen: Modul in unlockedModules?
   -> Nein: error 'Modul nicht erforscht'
2. Modul-Tier ermitteln aus MODULES[moduleId].tier
3. Kosten berechnen: 100 * tier
4. Credits pruefen und abziehen
5. addToInventory(userId, 'blueprint', moduleId, 1)
6. client.send('blueprintCopyResult', { success: true, moduleId, cost })
7. client.send('inventoryUpdated')
8. client.send('creditsUpdate', ...)
9. client.send('logEntry', 'BLUEPRINT KOPIE: ...')
```

### 4. Server — SectorRoom

Neuer Message-Handler registrieren:

```typescript
this.onMessage('createBlueprintCopy', (client, data) =>
  this.ships.handleCreateBlueprintCopy(client, data)
);
```

### 5. Client — Network

Neuer Sender:

```typescript
sendCreateBlueprintCopy(moduleId: string) {
  this.sectorRoom?.send('createBlueprintCopy', { moduleId });
}
```

Neuer Handler:

```typescript
room.onMessage('blueprintCopyResult', (data) => {
  if (data.success) {
    store.addLogEntry(`BLUEPRINT KOPIE: ${data.moduleId} (-${data.cost} CR)`);
  } else {
    store.addLogEntry(`BLUEPRINT FEHLER: ${data.error}`);
  }
});
```

### 6. Client — TechDetailPanel

Bei erforschten Modulen einen Button hinzufuegen:

```
[BLUEPRINT HERSTELLEN — {100 * tier} CR]
```

Button ist nur sichtbar wenn:
- Modul in `unlockedModules`
- Modul hat `cost` definiert (ist herstellbar)

Klick ruft `network.sendCreateBlueprintCopy(moduleId)` auf.

## Nicht im Scope

- Station-FABRIK (Blueprint einlegen, Modul produzieren) — separates Ticket
- Crafting-Tiefe (Zwischenmaterialien) — Follow-Up
- Stat-Varianz je nach Ressourcen — Follow-Up
- Schiffs-FABRIK Aenderungen — bleibt wie ist
- Blueprint-Raritaetsstufen — Follow-Up

## Testplan

- [ ] Modul im Tech-Tree erforschen -> Blueprint automatisch im Inventar
- [ ] [BLUEPRINT HERSTELLEN] im TechDetailPanel sichtbar fuer erforschte Module
- [ ] Klick zieht Credits ab und legt Blueprint ins Inventar
- [ ] Fehler bei zu wenig Credits
- [ ] Blueprint im CARGO sichtbar (BLUEPRINTS Tab)
- [ ] Blueprint in FABRIK-Programm sichtbar
- [ ] Mehrfache Kopien moeglich
