# voidSector NEWS — AI-generierte Nachrichten: Konzept

## Übersicht

Das NEWS-Programm empfängt server-weite Ereignisse und stellt sie als Nachrichtensendung dar.
Dieser Artikel beschreibt das Konzept für KI-gestützte Nachrichtengenerierung.

## Aktuelle Implementierung (Phase 1)

- **DB**: `news_events` Tabelle (event_type, headline, summary, event_data, player_name, quadrant_x/y)
- **Server**: Ereignisse werden bei Entdeckung aufgezeichnet:
  - `quadrant_discovery`: bei jedem Cross-Quadrant-Sprung
  - `alien_first_contact`: beim ersten Kontakt mit einer Alien-Fraktion
- **Client**: `NewsScreen.tsx` zeigt Meldungen im CRT-Nachrichtenstil
- **Aggregation**: Quadrant-Entdeckungen der letzten 30 Minuten werden als Gruppe zusammengefasst

## Phase 2: KI-gestützte Nachrichtengenerierung

### Option A: Gemini-Textgenerierung (empfohlen)

**Konzept**: Ein periodischer Server-Job (z. B. alle 30 Minuten) aggregiert neue Ereignisse
und sendet sie an die Gemini API, um daraus eine "Nachrichtensendung" zu generieren.

**Technischer Ablauf**:
```
1. Cron-Job (30-minütig): Hole neue news_events seit letztem Lauf
2. Baue Prompt: "Du bist ein Nachrichtensprecher in einem Sci-Fi-Universum..."
3. Sende an gemini-1.5-flash (kostengünstig, schnell)
4. Speichere generierten Text als news_broadcast in DB
5. Clients fragen /getNews → bekommen Broadcast + Rohdaten
```

**Prompt-Template**:
```
Du bist Nachrichtensprecher für "Void Sector News" — eine galaktische Nachrichtenagentur.
Stil: sachlich-zynisch, leicht satirisch. Kurze Sätze. CRT-Terminal-Ästhetik.

Heutige Ereignisse:
{events_json}

Erstelle eine Nachrichtensendung mit:
- 1 Hauptschlagzeile (max 60 Zeichen)
- 2-3 Kurzmeldungen (je max 100 Zeichen)
- 1 Schlussbemerkung (satirisch, max 80 Zeichen)

Format: JSON { "headline": "...", "items": [...], "closing": "..." }
```

**Kosten**: Gemini 1.5 Flash = ~$0.00035/1k Tokens; 30-Min-Job ≈ 500 Tokens = ~$0.0002/Run
→ Bei 48 Runs/Tag ≈ **$0.01/Tag** — vernachlässigbar.

### Option B: Lokales Template-System (Fallback)

Falls keine KI verfügbar: Handgebastelte Templates pro event_type mit variablen Einschüben.

```typescript
const TEMPLATES: Record<string, string[]> = {
  quadrant_discovery: [
    '{player} dringt in Quadrant [{qx}:{qy}] vor. Keine Überlebenden gemeldet.',
    'Grenzverschiebung: {player} markiert [{qx}:{qy}] als menschliche Zone.',
  ],
  alien_first_contact: [
    'Erstkontakt! {player} trifft auf {faction}. Die Galaxis hält den Atem an.',
    'Warnstufe BLAU: {faction} reagiert auf menschliche Kommunikation.',
  ],
};
```

### Option C: Bild-Generierung (deferred)

**Konzept**: Stable Diffusion / DALL-E für Nachrichtenbilder.
- Event-Typ → Bild-Prompt (z. B. "space news broadcast, CRT terminal, amber glow, pixel art")
- Bilder werden als Base64 in `event_data.image` gespeichert
- NewsScreen zeigt Bild als Hintergrund für Schlagzeilen

**Status**: Zurückgestellt — Kosten (~$0.04/Bild × viele Events) und Latenz zu hoch für Phase 2.

## Server-Konfiguration (Phase 2)

`packages/server/.env`:
```
GEMINI_API_KEY=...
NEWS_GENERATION_INTERVAL_MINUTES=30
```

`packages/server/src/jobs/newsGenerator.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
// Periodic job: fetch events, generate broadcast, store result
```

## Empfehlung

**Phase 2**: Option A (Gemini Text) + Option B als Fallback.
**Phase 3**: Option C (Bilder) wenn Budget vorhanden.

Priorität: Phase 2 umsetzen sobald Gemini API Key konfiguriert ist.
Die Infrastruktur (DB, Client, Server-Messages) ist in Phase 1 fertig.
