# Data Slates + Fraktionen — Design

**Date:** 2026-03-03
**Status:** Approved
**Phase:** 3 (Handel & Multiplayer)

## 1. Data Slates (Karten-Handel)

**Konzept:** Spieler erstellen "Data Slates" — digitale Karten von Sektoren die sie entdeckt haben. Handelbar über den Trading Post.

**Zwei Typen:**
- **Sektor-Slate** (1 Sektor): Kostet 1 AP. Enthält Typ + Ressourcen + Koordinaten eines entdeckten Sektors.
- **Gebiets-Slate** (NxN Gebiet): Kostet 3-5 AP je nach Scanner-Level. Enthält alle entdeckten Sektoren im Umkreis.

**Mechanik:**
- Slate erstellen im CARGO-Monitor (neuer "CREATE SLATE" Button)
- Slate = Item im Cargo (zählt als 1 Unit Platz)
- Verkauf über Trading Post (Spieler setzt Preis in Credits)
- Käufer "aktiviert" Slate → Sektoren werden zu seinen Discoveries hinzugefügt
- NPC-Aufkauf: 5 CR pro Sektor im Slate

**DB:**
- `data_slates` Tabelle: id, creator_id, slate_type ('sector'|'area'), sector_data JSONB, created_at
- Cargo: neuer Resource-Typ `slate` (Integer-Zähler wie ore/gas/crystal)
- Trade Orders: unterstützen resource='slate' für Marktplatz-Handel

## 2. Fraktions-System

**Struktur:**
- Fraktion: Name, Tag (3-5 Zeichen), Gründer, Beitrittsmodus
- 3 Ränge: Leader (1x), Officer (vom Leader ernannt), Member
- Leader: alles + Fraktion auflösen + Officers ernennen
- Officer: einladen, kicken (nur Members)
- Member: Fraktions-Chat, austreten

**Beitrittsmodus (konfigurierbar durch Leader):**
- `open` — jeder kann beitreten
- `code` — Einladungscode nötig (generiert von Leader/Officer)
- `invite` — direkte Einladung per Username (Spieler muss akzeptieren)

**Chat:** Bestehender `faction`-Channel wird aktiviert. Nachrichten an alle Online-Mitglieder, Offline = Pending Messages.

**DB:**
- `factions`: id, name, tag, leader_id, join_mode, invite_code, created_at
- `faction_members`: faction_id, player_id, rank ('leader'|'officer'|'member'), joined_at
- `faction_invites`: id, faction_id, inviter_id, invitee_id, status ('pending'|'accepted'|'rejected'), created_at

**UI:** Neuer Monitor `FACTION` in Sidebar. Zeigt: Mitgliederliste, Rang-Management, Beitrittsmodus, Einladungen.
