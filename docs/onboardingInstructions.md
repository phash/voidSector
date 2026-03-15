# Onboarding & HelpSlice Richtlinien

## Zweck

Das HelpSlice-System zeigt neuen Spielern kontextbezogene Tipps beim ersten Kontakt mit Spielmechaniken. Jeder Tipp erscheint nur einmal (localStorage) und verlinkt optional auf einen Kompendium-Artikel.

## Bestehende HelpSlices

| ID | Trigger | Beschreibung |
|----|---------|-------------|
| `first_login` | Erster Login | Radar-Bedienung, Zoom, Sektorauswahl |
| `first_nebula` | Erster Nebula-Sektor betreten | Gas-Ressourcen, Scan-Hinweis |
| `first_station` | Erste Station betreten | Handel, Reparatur, Upgrades |
| `first_asteroid` | Erstes Asteroidenfeld betreten | Erz, Scan → Mining Flow |
| `first_mining` | Erstes Mining gestartet | Mining-Laser Kauf-Anleitung (Station → SHOP → MODULE) |
| `first_acep_tab` | ACEP-Tab geöffnet | 4 Pfade erklärt, XP-Investment |
| `first_module_tab` | MODULE-Tab geöffnet | 8 Slots, Einbau/Ausbau, Extra-Slots |
| `first_shop_tab` | SHOP-Tab geöffnet | Freischaltung, Bezahlung, MK.I-Hinweis |
| `first_pirate` | Erster Piraten-Kontakt | Kampf/Flucht/Verhandlung |
| `first_distress` | Erster Notruf | Rettungsmission erklärt |
| `low_fuel` | Treibstoff niedrig | Auftanken an Station, Notfall-Option |
| `first_anomaly` | Erste Anomalie | XP, Ruf-Boni, Scan-Hinweis |
| `ap-depleted-first` | AP erstmals leer | AP-Regeneration erklärt |

## Regeln für neue HelpSlices

### Wann erstellen

- **Jede neue Spielmechanik** braucht einen HelpSlice beim ersten Kontakt
- **Jeder Screen/Tab** der noch keinen hat, bekommt einen
- **Jeder wichtige Entscheidungspunkt** (erster Kampf, erste Quest, erster Handel, etc.)
- **Jede Situation die einen Anfänger verwirren könnte**

### Wie erstellen

1. **Eintrag** in `packages/client/src/state/helpSlice.ts` → `HELP_TIPS` Array:
   ```typescript
   {
     id: 'first_<feature>',       // eindeutige ID, Prefix "first_" für Erstbenutzer-Tipps
     title: 'TITEL IN GROSSBUCHSTABEN',
     body: 'Kurze Erklärung was der User hier machen kann.\n\n'
       + '→ Schritt-für-Schritt wenn nötig\n'
       + '→ Maximal 5-6 Zeilen\n'
       + '→ Konkrete Aktionen, keine vagen Beschreibungen',
     articleId: 'kompendium-artikel-id',  // optional, verlinkt zum Kompendium
   }
   ```

2. **Trigger** an der richtigen Stelle:
   ```typescript
   const showTip = useStore((s) => s.showTip);
   // Bei Betreten eines Screens/Tabs:
   useEffect(() => { showTip('first_<feature>'); }, [showTip]);
   // Bei einer Aktion:
   if (!wasMining && data.active) { store.showTip('first_mining'); }
   ```

3. **[?] Button** neben dem Titel/Header der Stelle platzieren:
   ```tsx
   <button
     onClick={() => showTip('first_<feature>')}
     style={{
       background: 'none',
       border: '1px solid var(--color-dim)',
       color: 'var(--color-dim)',
       fontFamily: 'var(--font-mono)',
       fontSize: '0.65rem',
       padding: '0 4px',
       cursor: 'pointer',
       marginLeft: 4,
     }}
     title="Hilfe"
   >
     [?]
   </button>
   ```
   Der [?] Button zeigt den HelpSlice erneut an (auch wenn bereits gesehen), damit der User die Hilfe jederzeit aufrufen kann.

### Schreibstil

- **Deutsch** — das Spiel ist auf Deutsch
- **Direkt und konkret** — "Klicke X" statt "Man kann X anklicken"
- **Schritte mit →** für Anleitungen
- **Kurz** — maximal 5-6 Zeilen, kein Fließtext
- **Spieler-Perspektive** — was kann ICH hier tun?
- **Immer eine Handlungsanweisung** — der Spieler soll wissen was der nächste Schritt ist

### Fehlende HelpSlices (TODO)

Screens/Features die noch HelpSlices brauchen:

- [ ] NAV-COM Programm (Navigation, Autopilot, Hyperjump)
- [ ] TRADE / Handel an Station
- [ ] QUEST-Annahme (erster Quest angenommen)
- [ ] TECH-TREE / Forschung
- [ ] QUAD-MAP (Quadranten-Karte)
- [ ] FRIENDS-System
- [ ] FABRIK / Station-Produktion
- [ ] Erster Alien-Kontakt
- [ ] Erster Kampf V2
- [ ] Bookmark setzen
- [ ] Erster Hyperjump
- [ ] Wrack gefunden
