# Feedback Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating "FEEDBACK" button lets logged-in (non-guest) players submit a categorized message; submissions land in a new "FEEDBACK" tab in the admin console where they can be read and marked new/done.

**Architecture:** Mirrors the existing "stories" admin feature end-to-end: a dedicated `feedback` table → `feedbackQueries` → a public `POST /api/feedback` submit route (player-token auth, guests rejected) + admin `GET/PATCH /admin/api/feedback` routes → an admin-console tab → a client overlay (`FeedbackButton`) mounted beside `HelpOverlay`.

**Tech Stack:** PostgreSQL + `pg` · Express (colyseus `@colyseus/tools` app) · React + Zustand · Vitest + RTL · vanilla JS admin console.

---

## Reference: verified anchors

- Migrations dir `packages/server/src/db/migrations/` — highest is `084_category_tech.sql`; **next is 085**. Idempotent, auto-run on startup.
- `query` helper: `packages/server/src/db/client.ts:16` → `query<T extends pg.QueryResultRow>(text, params?): Promise<pg.QueryResult<T>>` (has `.rows`, `.rowCount`). UPDATE/INSERT without RETURNING may be called without a generic (see `civQueries`).
- Auth: `packages/server/src/auth.ts:13` `interface AuthPayload { userId; username; isGuest?: boolean }`; `verifyToken(token): AuthPayload` at line 64 (throws on bad token). Guest tokens are signed with `isGuest: true`.
- Admin: `packages/server/src/adminRoutes.ts` — `adminRouter` with `adminRouter.use(adminAuth)` (Bearer `ADMIN_TOKEN`); `logAdminEvent(action, details)` imported from `./db/adminQueries.js`; `logger` imported. Story routes (`adminRouter.post/get('/stories'…)`) are the template.
- Admin console: `packages/server/src/admin/console.html` — tab bar `<div id="tab-bar">` with `<div class="tab" data-tab="…">`; `switchTab(name)` dispatches `loadX()`; `api(method, path, body)` helper attaches `Authorization: Bearer`; `loadStories()` is the list template; helpers `el`, `esc`, `clearChildren`, `formatDate`, `toast`.
- Client: `app.config.ts` `initializeExpress(app)` already defines `app.post('/api/register'…)` etc. and imports `logger`. Store has `token`, `isGuest`, `addLogEntry`, `showTip`. Overlays mount in `GameScreen.tsx` as siblings (`<HelpOverlay />` etc.). REST base: `import.meta.env.VITE_API_URL || ''`. CSS vars `--color-primary`/`--color-dim`/`--font-mono`, class `vs-btn`. `mockStore.ts` provides default store state for RTL (has `token:'test-token'`, `isGuest:false`, `showTip:vi.fn()`; **lacks `addLogEntry`** → add it).
- **Client test gate is vitest/Vite build, NOT `tsc` (≈111 pre-existing tsc errors).**

---

## File Structure

**Create:**
- `packages/server/src/db/migrations/085_feedback.sql` — feedback table.
- `packages/server/src/db/feedbackQueries.ts` — `createFeedback` / `getFeedback` / `setFeedbackStatus` + row type.
- `packages/server/src/feedbackValidation.ts` — pure `validateFeedbackInput`.
- `packages/server/src/__tests__/feedbackValidation.test.ts` — unit test.
- `packages/client/src/components/FeedbackButton.tsx` — floating FAB + modal.
- `packages/client/src/__tests__/FeedbackButton.test.tsx` — RTL test.

**Modify:**
- `packages/server/src/app.config.ts` — `POST /api/feedback` submit route.
- `packages/server/src/adminRoutes.ts` — `GET /admin/api/feedback` + `PATCH /admin/api/feedback/:id`.
- `packages/server/src/admin/console.html` — FEEDBACK tab + panel + `loadFeedback()` + `switchTab` case.
- `packages/client/src/components/GameScreen.tsx` — mount `<FeedbackButton />`.
- `packages/client/src/state/helpSlice.ts` — `first_feedback` tip.
- `packages/client/src/test/mockStore.ts` — add `addLogEntry` default.

---

## Task 1: DB migration

**Files:** Create `packages/server/src/db/migrations/085_feedback.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Feedback: player-submitted feedback shown in the admin console
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  player_id UUID,
  username VARCHAR(64),
  category VARCHAR(16) NOT NULL DEFAULT 'other',  -- bug | idea | praise | other
  message  TEXT NOT NULL,
  status   VARCHAR(16) NOT NULL DEFAULT 'new',     -- new | done
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback (status, created_at DESC);
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/085_feedback.sql
git commit -m "feat: feedback table migration 085"
```

---

## Task 2: feedbackQueries

**Files:** Create `packages/server/src/db/feedbackQueries.ts`

- [ ] **Step 1: Write the module**

```typescript
import { query } from './client.js';

export interface FeedbackRow {
  id: number;
  playerId: string | null;
  username: string | null;
  category: string;
  message: string;
  status: string;
  createdAt: string;
}

export async function createFeedback(input: {
  playerId: string | null;
  username: string | null;
  category: string;
  message: string;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO feedback (player_id, username, category, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.playerId, input.username, input.category, input.message],
  );
  return res.rows[0].id;
}

export async function getFeedback(limit = 100): Promise<FeedbackRow[]> {
  const res = await query<{
    id: number;
    player_id: string | null;
    username: string | null;
    category: string;
    message: string;
    status: string;
    created_at: string;
  }>(
    `SELECT id, player_id, username, category, message, status, created_at
       FROM feedback
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    username: r.username,
    category: r.category,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setFeedbackStatus(id: number, status: string): Promise<void> {
  await query(`UPDATE feedback SET status = $1 WHERE id = $2`, [status, id]);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/server && npx tsc --noEmit`
Expected: exits 0 (no new errors referencing feedbackQueries).

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/feedbackQueries.ts
git commit -m "feat: feedbackQueries (create/list/setStatus)"
```

---

## Task 3: validateFeedbackInput (pure) + test

**Files:**
- Create `packages/server/src/feedbackValidation.ts`
- Test `packages/server/src/__tests__/feedbackValidation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { validateFeedbackInput } from '../feedbackValidation.js';

describe('validateFeedbackInput', () => {
  it('accepts a valid message + category', () => {
    expect(validateFeedbackInput({ category: 'bug', message: 'kaputt' })).toEqual({
      category: 'bug',
      message: 'kaputt',
    });
  });

  it('trims the message', () => {
    expect(validateFeedbackInput({ category: 'idea', message: '  hallo  ' })).toEqual({
      category: 'idea',
      message: 'hallo',
    });
  });

  it('defaults a missing category to other', () => {
    expect(validateFeedbackInput({ message: 'x' })).toEqual({ category: 'other', message: 'x' });
  });

  it('falls back an unknown category to other', () => {
    expect(validateFeedbackInput({ category: 'nope', message: 'x' })).toEqual({
      category: 'other',
      message: 'x',
    });
  });

  it('rejects an empty/whitespace message', () => {
    expect('error' in validateFeedbackInput({ category: 'bug', message: '   ' })).toBe(true);
    expect('error' in validateFeedbackInput({ category: 'bug' })).toBe(true);
  });

  it('rejects an oversized message (>2000)', () => {
    expect('error' in validateFeedbackInput({ message: 'a'.repeat(2001) })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS**

Run: `cd packages/server && npx vitest run src/__tests__/feedbackValidation.test.ts`
Expected: FAIL — cannot resolve `../feedbackValidation.js`.

- [ ] **Step 3: Implement `feedbackValidation.ts`**

```typescript
const CATEGORIES = ['bug', 'idea', 'praise', 'other'] as const;
export type FeedbackCategory = (typeof CATEGORIES)[number];

export interface ValidFeedback {
  category: FeedbackCategory;
  message: string;
}
export interface FeedbackError {
  error: string;
}

/** Pure validation for incoming feedback. Returns the normalized payload or an error. */
export function validateFeedbackInput(body: unknown): ValidFeedback | FeedbackError {
  const b = (body ?? {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (message.length === 0) return { error: 'message required' };
  if (message.length > 2000) return { error: 'message too long (max 2000)' };
  const raw = typeof b.category === 'string' ? b.category : 'other';
  const category = (CATEGORIES as readonly string[]).includes(raw)
    ? (raw as FeedbackCategory)
    : 'other';
  return { category, message };
}
```

- [ ] **Step 4: Run the test, verify it PASSES**

Run: `cd packages/server && npx vitest run src/__tests__/feedbackValidation.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/feedbackValidation.ts packages/server/src/__tests__/feedbackValidation.test.ts
git commit -m "feat: validateFeedbackInput pure helper + tests"
```

---

## Task 4: Submit route `POST /api/feedback`

**Files:** Modify `packages/server/src/app.config.ts`

- [ ] **Step 1: Add imports**

At the top of `packages/server/src/app.config.ts`, alongside the existing imports, add:

```typescript
import { verifyToken, type AuthPayload } from './auth.js';
import { validateFeedbackInput } from './feedbackValidation.js';
import { createFeedback } from './db/feedbackQueries.js';
```

> If `register`/`login` are already imported from `./auth.js`, add `verifyToken, type AuthPayload` to that existing import instead of a duplicate line.

- [ ] **Step 2: Add the route inside `initializeExpress`**

In `initializeExpress: (app) => { … }`, immediately after the existing `app.post('/api/guest', …)` handler, add:

```typescript
    app.post('/api/feedback', async (req: Request, res: Response) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        let auth: AuthPayload;
        try {
          auth = verifyToken(authHeader.slice(7));
        } catch {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
        if (auth.isGuest) {
          res.status(403).json({ error: 'Guests cannot submit feedback' });
          return;
        }
        const result = validateFeedbackInput(req.body);
        if ('error' in result) {
          res.status(400).json({ error: result.error });
          return;
        }
        const id = await createFeedback({
          playerId: auth.userId,
          username: auth.username,
          category: result.category,
          message: result.message,
        });
        res.status(201).json({ id });
      } catch (err) {
        logger.error({ err }, 'Feedback submit error');
        res.status(500).json({ error: 'Internal server error' });
      }
    });
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/server && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/app.config.ts
git commit -m "feat: POST /api/feedback submit route (player auth, no guests)"
```

---

## Task 5: Admin routes (list + status)

**Files:** Modify `packages/server/src/adminRoutes.ts`

- [ ] **Step 1: Add the import**

Near the other `./db/…` imports in `adminRoutes.ts`, add:

```typescript
import { getFeedback, setFeedbackStatus } from './db/feedbackQueries.js';
```

- [ ] **Step 2: Add the two routes**

Anywhere among the other `adminRouter.*` route definitions (e.g., right after the `/stories` routes), add:

```typescript
adminRouter.get('/feedback', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const feedback = await getFeedback(limit);
    res.json({ feedback });
  } catch (err) {
    logger.error({ err }, 'Admin list feedback error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/feedback/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const status = (req.body as { status?: string }).status;
    if (status !== 'new' && status !== 'done') {
      res.status(400).json({ error: 'status must be new or done' });
      return;
    }
    await setFeedbackStatus(id, status);
    await logAdminEvent('set_feedback_status', { id, status });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin set feedback status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/server && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/adminRoutes.ts
git commit -m "feat: admin feedback list + status routes"
```

---

## Task 6: Admin console FEEDBACK tab

**Files:** Modify `packages/server/src/admin/console.html`

This file is large and not type-checked. **Read the relevant sections first** (the `<div id="tab-bar">` block, the `switchTab` function, the stories tab-panel, and the `loadStories` function) to get exact surrounding text, then make these four insertions. Verify by loading the admin page after the server runs.

- [ ] **Step 1: Add the tab**

In the `<div id="tab-bar">` block, after the last tab (e.g. `<div class="tab" data-tab="drones">DROHNEN</div>`), add:

```html
  <div class="tab" data-tab="feedback">FEEDBACK</div>
```

- [ ] **Step 2: Add the panel**

After the stories tab-panel's closing `</div>` (the panel whose id is `panel-stories`), add:

```html
<!-- ── FEEDBACK Tab ─────────────────────────────────────────── -->
<div class="tab-panel" id="panel-feedback">
  <div class="section-title">Feedback</div>
  <div style="color:var(--amber-dim);font-size:11px;margin-bottom:16px;letter-spacing:0.5px">
    Spieler-Feedback aus dem schwebenden FEEDBACK-Button
  </div>
  <div id="feedback-empty" class="empty-state" style="display:none">Noch kein Feedback.</div>
  <div id="feedback-list" style="display:flex;flex-direction:column;gap:12px;overflow:auto;max-height:calc(100vh - 200px);padding-right:8px"></div>
</div>
```

- [ ] **Step 3: Add the `switchTab` case**

In the `switchTab(name)` function, after the line `else if (name === 'config') loadConfig();` (or the last `else if`), add:

```javascript
  else if (name === 'feedback') loadFeedback();
```

- [ ] **Step 4: Add the `loadFeedback` function**

Immediately after the `loadStories` function definition, add:

```javascript
function loadFeedback() {
  api('GET', '/feedback?limit=100').then(function (data) {
    var items = data.feedback || [];
    var container = document.getElementById('feedback-list');
    var empty = document.getElementById('feedback-empty');
    clearChildren(container);
    if (items.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    items.forEach(function (fb) {
      var card = el('div', { className: 'card' });
      var done = fb.status === 'done';
      card.style.opacity = done ? '0.5' : '1';
      card.innerHTML =
        '<strong>[' + esc(fb.category) + ']</strong> ' +
        esc(fb.username || 'anonym') +
        ' <small>' + formatDate(fb.createdAt || fb.created_at) + '</small><br>' +
        '<div style="margin:6px 0;white-space:pre-wrap">' + esc(fb.message) + '</div>';
      var btn = el('button', { className: 'btn' });
      btn.textContent = done ? 'als NEU markieren' : 'als ERLEDIGT markieren';
      btn.onclick = function () {
        api('PATCH', '/feedback/' + fb.id, { status: done ? 'new' : 'done' })
          .then(loadFeedback)
          .catch(function (err) { toast('Status-Update fehlgeschlagen: ' + err.message, 'error'); });
      };
      card.appendChild(btn);
      container.appendChild(card);
    });
  }).catch(function (err) {
    toast('Feedback laden fehlgeschlagen: ' + err.message, 'error');
  });
}
```

> Note: `loadFeedback` uses `el`, `esc`, `clearChildren`, `formatDate`, `toast`, `api` — all already defined in console.html. If the button class differs from `btn`, match whatever class the existing action buttons use (read a sibling `loadX` for the convention).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/admin/console.html
git commit -m "feat: admin console FEEDBACK tab"
```

---

## Task 7: HelpSlice `first_feedback`

**Files:** Modify `packages/client/src/state/helpSlice.ts`

- [ ] **Step 1: Add the tip to `HELP_TIPS`**

In `packages/client/src/state/helpSlice.ts`, add this object to the `HELP_TIPS` array (e.g. right after the `first_xeno` entry, or any existing entry — match the surrounding formatting):

```typescript
  {
    id: 'first_feedback',
    title: '◈ FEEDBACK',
    body:
      'Sag uns, was du denkst!\n\n' +
      '→ Kategorie wählen: Bug, Idee, Lob oder Sonstiges\n' +
      '→ Nachricht schreiben und [SENDEN]\n' +
      '→ Dein Feedback landet direkt beim Admin-Team',
  },
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/state/helpSlice.ts
git commit -m "feat: first_feedback help tip"
```

---

## Task 8: FeedbackButton component + test + mount

**Files:**
- Create `packages/client/src/components/FeedbackButton.tsx`
- Test `packages/client/src/__tests__/FeedbackButton.test.tsx`
- Modify `packages/client/src/components/GameScreen.tsx`
- Modify `packages/client/src/test/mockStore.ts`

- [ ] **Step 1: Add `addLogEntry` default to `mockStore.ts`**

In `packages/client/src/test/mockStore.ts`, find the line `showTip: vi.fn(),` and add directly after it:

```typescript
    addLogEntry: vi.fn(),
```

- [ ] **Step 2: Write the failing test**

Create `packages/client/src/__tests__/FeedbackButton.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackButton } from '../components/FeedbackButton';
import { mockStoreState } from '../test/mockStore';

describe('FeedbackButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is hidden for guests', () => {
    mockStoreState({ token: 'tok', isGuest: true } as any);
    render(<FeedbackButton />);
    expect(screen.queryByTestId('feedback-fab')).toBeNull();
  });

  it('is hidden when not logged in', () => {
    mockStoreState({ token: null, isGuest: false } as any);
    render(<FeedbackButton />);
    expect(screen.queryByTestId('feedback-fab')).toBeNull();
  });

  it('shows for a logged-in non-guest and opens the modal (send disabled while empty)', async () => {
    mockStoreState({ token: 'tok', isGuest: false } as any);
    render(<FeedbackButton />);
    const fab = screen.getByTestId('feedback-fab');
    expect(fab).toBeInTheDocument();
    await userEvent.click(fab);
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-send')).toBeDisabled();
  });

  it('submits with auth header + payload and closes', async () => {
    mockStoreState({ token: 'tok123', isGuest: false } as any);
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) } as Response);
    render(<FeedbackButton />);
    await userEvent.click(screen.getByTestId('feedback-fab'));
    await userEvent.selectOptions(screen.getByTestId('feedback-category'), 'bug');
    await userEvent.type(screen.getByTestId('feedback-message'), 'Es ruckelt');
    await userEvent.click(screen.getByTestId('feedback-send'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/feedback');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect(JSON.parse(opts.body as string)).toEqual({ category: 'bug', message: 'Es ruckelt' });
    await waitFor(() => expect(screen.queryByTestId('feedback-modal')).toBeNull());
  });
});
```

- [ ] **Step 3: Run the test, verify it FAILS**

Run: `cd packages/client && npx vitest run src/__tests__/FeedbackButton.test.tsx`
Expected: FAIL — cannot resolve `../components/FeedbackButton`.

- [ ] **Step 4: Implement `FeedbackButton.tsx`**

Create `packages/client/src/components/FeedbackButton.tsx`:

```tsx
import { useState } from 'react';
import { useStore } from '../state/store';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idee' },
  { value: 'praise', label: 'Lob' },
  { value: 'other', label: 'Sonstiges' },
];

export function FeedbackButton() {
  const token = useStore((s) => s.token);
  const isGuest = useStore((s) => s.isGuest);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const showTip = useStore((s) => s.showTip);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!token || isGuest) return null;

  function openModal() {
    setError(null);
    setOpen(true);
    showTip('first_feedback');
  }

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, message: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Fehler ${res.status}`);
      }
      addLogEntry('Danke für dein Feedback!');
      setMessage('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        data-testid="feedback-fab"
        onClick={openModal}
        title="Feedback geben"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9000,
          background: '#0a0a0a',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        FEEDBACK
      </button>
      {open && (
        <div
          data-testid="feedback-modal"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9001,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0a0a0a',
              border: '1px solid var(--color-primary)',
              padding: 16,
              width: 'min(420px, 90vw)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', letterSpacing: '0.2em', flex: 1 }}>FEEDBACK</span>
              <button
                onClick={() => showTip('first_feedback')}
                title="Hilfe"
                style={{
                  background: 'none',
                  border: '1px solid var(--color-dim)',
                  color: 'var(--color-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  padding: '0 4px',
                  cursor: 'pointer',
                }}
              >
                [?]
              </button>
            </div>
            <select
              data-testid="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 8,
                background: '#0d0d0d',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                padding: 4,
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <textarea
              data-testid="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Dein Feedback…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0d0d0d',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                padding: 4,
                resize: 'vertical',
              }}
            />
            {error && (
              <div style={{ color: '#FF4444', fontSize: '0.75rem', marginTop: 4 }}>⚠ {error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button className="vs-btn" onClick={() => setOpen(false)}>
                [ABBRECHEN]
              </button>
              <button
                className="vs-btn"
                data-testid="feedback-send"
                disabled={!message.trim() || sending}
                onClick={submit}
              >
                {sending ? '…' : '[SENDEN]'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run the test, verify it PASSES**

Run: `cd packages/client && npx vitest run src/__tests__/FeedbackButton.test.tsx`
Expected: PASS — 4 tests. (Ignore the benign `.vite/results.json` EACCES; check the `Tests … passed` line.)

- [ ] **Step 6: Mount in `GameScreen.tsx`**

In `packages/client/src/components/GameScreen.tsx`, add the import near the other component imports:

```typescript
import { FeedbackButton } from './FeedbackButton';
```

Then, in the render tree where the overlays are mounted as siblings, add `<FeedbackButton />` right after `<HelpOverlay />`. Replace:

```tsx
      <HelpOverlay />
```

with:

```tsx
      <HelpOverlay />
      <FeedbackButton />
```

- [ ] **Step 7: Build the client to confirm it compiles**

Run: `cd packages/client && npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/components/FeedbackButton.tsx packages/client/src/__tests__/FeedbackButton.test.tsx packages/client/src/components/GameScreen.tsx packages/client/src/test/mockStore.ts
git commit -m "feat: floating FeedbackButton + modal (logged-in users)"
```

---

## Task 9: Full verification

- [ ] **Step 1: Server suite**

Run: `cd packages/server && npx vitest run`
Expected: all pass (incl. the 6 `feedbackValidation` tests).

- [ ] **Step 2: Client suite**

Run: `cd packages/client && npx vitest run`
Expected: all pass (incl. the 4 `FeedbackButton` tests). Confirm via the `Test Files … passed` line.

- [ ] **Step 3: Lint changed files**

Run: `cd packages/server && npx eslint src/feedbackValidation.ts src/db/feedbackQueries.ts src/app.config.ts src/adminRoutes.ts` and `cd packages/client && npx eslint src/components/FeedbackButton.tsx`
Expected: 0 errors.

- [ ] **Step 4: Manual/E2E (after deploy or local docker)**

1. Log in as a registered (non-guest) user → the FEEDBACK button shows bottom-right; as a guest it does not.
2. Click it → pick a category, type a message → [SENDEN] → "Danke für dein Feedback!" and the modal closes.
3. Open the admin console → FEEDBACK tab → the entry appears (category, username, message, time).
4. Click "als ERLEDIGT markieren" → status flips and persists on reload.

---

## Self-Review

**Spec coverage:** table+migration (T1) · queries (T2) · validation (T3) · submit endpoint with player-auth + guest-403 (T4) · admin list+status routes (T5) · admin console tab (T6) · help tip (T7) · floating button + modal + guest-gating + submit + mount (T8) · tests server+client (T3/T8/T9). Guest exclusion enforced both client-side (button hidden) and server-side (403 via `auth.isGuest`) — risk from the spec resolved.

**Placeholder scan:** none — every code step has complete code.

**Type consistency:** `validateFeedbackInput` returns `ValidFeedback | FeedbackError` (`'error' in result` discriminates) used consistently in T3/T4. `createFeedback`/`getFeedback`/`setFeedbackStatus` signatures match between T2 and their callers in T4/T5. Category set {bug,idea,praise,other} consistent across validation (T3), client `CATEGORIES` (T8), and DB default (T1). Status {new,done} consistent across T1/T5/T6.
