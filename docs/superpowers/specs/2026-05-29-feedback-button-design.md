# Feedback Button — Design

**Date:** 2026-05-29 · **Status:** approved (design)

## Goal

A floating "FEEDBACK" button in the running app lets logged-in players send feedback (a message + a category). Submitted feedback lands in the admin console as a new "FEEDBACK" tab where it can be read and marked new/done. Mirrors the existing "stories" admin feature end-to-end.

## Decisions (locked with user)

- **Content:** free-text `message` + `category` ∈ {bug, idea, praise, other}.
- **Access:** logged-in users only — guests do not see the button and cannot submit (the submit endpoint requires a valid player token).
- **Admin:** list newest-first; per entry toggle status new ↔ done.
- **Out of scope (YAGNI):** rate limiting (logged-in-only ⇒ low risk), screenshots/attachments, email notification, editing/replying to feedback.

## Architecture

Reuses the proven "stories" pattern: dedicated DB table → query module → REST endpoints → admin-console tab → client overlay mounted alongside `HelpOverlay`.

### Database — migration `085_feedback.sql`
```sql
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  player_id UUID,                                  -- from token; nullable defensively
  username VARCHAR(64),
  category VARCHAR(16) NOT NULL DEFAULT 'other',   -- bug | idea | praise | other
  message  TEXT NOT NULL,
  status   VARCHAR(16) NOT NULL DEFAULT 'new',     -- new | done
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback(status, created_at DESC);
```
(All migrations are idempotent and auto-run on startup. 085 is the next number after 084.)

### Server
- **Queries** (`packages/server/src/db/feedbackQueries.ts`):
  - `createFeedback({ playerId, username, category, message }): Promise<number>` — INSERT, RETURNING id.
  - `getFeedback(limit = 100): Promise<FeedbackRow[]>` — SELECT ordered `created_at DESC`.
  - `setFeedbackStatus(id, status): Promise<void>` — UPDATE status.
- **Validation helper** (pure, unit-tested): `validateFeedbackInput(body): { category, message } | { error }` — category must be in the allowed set (default `other` if missing), message required and trimmed length 1..2000.
- **Submit endpoint** — public Express route in `app.config.ts` `initializeExpress` (sibling of `/api/register`): `POST /api/feedback`.
  - Requires `Authorization: Bearer <playerToken>`; verifies via `verifyToken` (same helper `SectorRoom.onAuth` uses). Missing/invalid → 401. This enforces "logged-in only". `player_id`/`username` come from the verified payload.
  - Body `{ category, message }` validated by the helper; invalid → 400. Insert → 201 `{ id }`.
- **Admin list** — `GET /admin/api/feedback?limit=100` under `adminRouter` (Bearer `ADMIN_TOKEN`) → `{ feedback: [...] }`.
- **Admin status** — `PATCH /admin/api/feedback/:id` body `{ status }` under `adminRouter`; validates status ∈ {new, done}; calls `setFeedbackStatus` + `logAdminEvent('set_feedback_status', { id, status })`.

### Admin console (`packages/server/src/admin/console.html`)
- Add `<div class="tab" data-tab="feedback">FEEDBACK</div>` to the tab bar.
- Add `<div class="tab-panel" id="panel-feedback">` with an empty-state + list container (mirror the stories panel).
- Add `else if (name === 'feedback') loadFeedback();` to `switchTab()`.
- `loadFeedback()` (mirror `loadStories()`): `api('GET','/feedback?limit=100')`, render each entry as a card — category badge, username, message, formatted date, and a button to toggle status (calls `api('PATCH','/feedback/'+id, { status })` then reloads). Done entries visually dimmed.

### Client
- **`FeedbackButton.tsx`** — floating FAB: `position:fixed; bottom:16px; right:16px; z-index:9000`, CRT-amber (`var(--color-primary)`/`--color-dim`, `var(--font-mono)`), label `FEEDBACK`. Rendered only when `token && !isGuest` (reads store). Click → opens the modal (local `open` state, or a small `uiSlice`/local state).
- **`FeedbackModal.tsx`** (can live in the same file) — overlay (fixed, dim backdrop, CRT box): category select (Bug/Idee/Lob/Sonstiges), `<textarea>` for the message, `[SENDEN]` (disabled when message is empty/whitespace) and `[ABBRECHEN]`. Header shows a `[?]` button → `showTip('first_feedback')`.
  - Submit → `fetch(`${import.meta.env.VITE_API_URL || ''}/api/feedback`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ category, message }) })`.
  - Success → close, clear, `addLogEntry('Danke für dein Feedback!')` (toast/log). Failure → inline error text in the modal.
- **Mount** `<FeedbackButton />` in `GameScreen.tsx` alongside `<HelpOverlay />`.
- **HelpSlice** `first_feedback` (CLAUDE.md onboarding rule): German, ≤6 lines — what the button does and the categories. Shown on first modal open; re-openable via the modal-header `[?]`.

### Data flow
Click FAB → modal → submit → `POST /api/feedback` (player-token auth) → INSERT → 201 → modal closes with thanks. Admin opens console → FEEDBACK tab → `GET /admin/api/feedback` → list → toggle status → `PATCH /admin/api/feedback/:id`.

## Components (isolation)
- `validateFeedbackInput` — pure, no IO, unit-tested directly (category whitelist + message length).
- `feedbackQueries` — thin DB layer, mirrors `adminQueries` story functions.
- `FeedbackButton`/`FeedbackModal` — presentation + one fetch; no business logic beyond enabling submit.

## Testing
- **Server unit:** `validateFeedbackInput` — accepts valid, defaults missing category to `other`, rejects empty/oversized message, rejects unknown category.
- **Client unit (RTL + `vi.mock` fetch):**
  - Button hidden when `isGuest` true / no token; visible when `token && !isGuest`.
  - Opening the modal renders category select + textarea; `[SENDEN]` disabled on empty message.
  - Submit posts to `/api/feedback` with `Authorization: Bearer <token>` and `{ category, message }`; success closes the modal.
- **Manual/E2E:** submit from the app → entry appears in admin FEEDBACK tab → toggle new/done persists.

## Risks
- Guest exclusion is enforced client-side (button hidden) + server-side by requiring a valid token; if guest tokens are indistinguishable from user tokens server-side, the practical control is the UI gate (acceptable for low-stakes feedback). Verify whether the JWT payload carries a guest flag during implementation; enforce server-side if available.
- New 15th-ish program is unaffected; the FAB is an overlay, not a cockpit program, so it does not touch the 6-section/mobile layout.
