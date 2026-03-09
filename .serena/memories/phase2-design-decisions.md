# Phase 2 — Design-Entscheidungen (Gesperrt)

**Datum**: 2026-03-06

## Sprachstandardisierung
- **Entscheidung**: Deutsch UI-Strings mit i18n-Vorbereitung
- **Bedeutung**: Alle neuen Strings in Deutsch schreiben, aber Struktur für zukünftige Lokalisierung vorbereiten (z.B. mit `t()` Keys)
- **Umsetzung**: Keys in `shared/i18n/` oder separate JSON-Datei; Client-Side oder Server-Side je nach Kontext

## Artefakt-NPC-Handelsmechanik
- **Entscheidung**: Nur "Freie Händler" NPCs kaufen/verkaufen Artefakte (später implementiert)
- **Phase**: Post-Phase-2 (wird in Phase 3+ geplant)
- **Bedeutung**: Für jetzt nur Drop-Chancen implementieren, Händler-Mechanic später

## Player-Base-Timing
- **Entscheidung**: Erste Base kann sofort ohne Kosten gebaut werden
- **GitHub Issue**: #150
- **Bedeutung**: Keine Level-Requirement, keine Credits-Kosten für erste Base; nachfolgende Basen haben dann Kosten (TBD)

---
**Status**: Diese Entscheidungen blockieren Phase 2 Week 1–2 nicht mehr. Implementation kann starten.
