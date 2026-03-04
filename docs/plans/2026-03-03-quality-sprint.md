# Quality Sprint — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase server test coverage (add tests for tradeRoutes, worldgen, auth validation, comms edge cases), set up Playwright E2E tests with user stories, and implement two-level cheat protection.

**Architecture:** No new features — pure quality improvements. All in `fix/quality-sprint` branch.

**Tech Stack:** Vitest (existing), Playwright (new), TypeScript

---

### Task 1: Tests — tradeRoutes + worldgen

**Files:**
- Create: `packages/server/src/engine/__tests__/tradeRoutes.test.ts`
- Create: `packages/server/src/engine/__tests__/worldgen.test.ts`

**Step 1: Write tradeRoutes tests**

Create `packages/server/src/engine/__tests__/tradeRoutes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isRouteCycleDue, calculateRouteFuelCost, validateRouteConfig } from '../tradeRoutes.js';
import { TRADE_ROUTE_MIN_CYCLE, TRADE_ROUTE_MAX_CYCLE, MAX_TRADE_ROUTES } from '@void-sector/shared';

describe('isRouteCycleDue', () => {
  it('returns true when lastCycleAt is null', () => {
    expect(isRouteCycleDue(null, 60)).toBe(true);
  });
  it('returns false when cycle has not elapsed', () => {
    expect(isRouteCycleDue(Date.now(), 60)).toBe(false);
  });
  it('returns true when cycle has elapsed', () => {
    const past = Date.now() - 61 * 60 * 1000;
    expect(isRouteCycleDue(past, 60)).toBe(true);
  });
});

describe('calculateRouteFuelCost', () => {
  it('returns 0 for same position', () => {
    expect(calculateRouteFuelCost(0, 0, 0, 0)).toBe(0);
  });
  it('calculates correct fuel for horizontal route', () => {
    // distance = 3, fuel = ceil(3 * FUEL_PER_DISTANCE)
    const cost = calculateRouteFuelCost(0, 0, 3, 0);
    expect(cost).toBeGreaterThan(0);
  });
  it('calculates diagonal correctly', () => {
    // distance = sqrt(2) ≈ 1.414
    const cost = calculateRouteFuelCost(0, 0, 1, 1);
    expect(cost).toBeGreaterThan(0);
  });
});

describe('validateRouteConfig', () => {
  it('accepts valid config', () => {
    const result = validateRouteConfig({ cycleMinutes: TRADE_ROUTE_MIN_CYCLE });
    expect(result.valid).toBe(true);
  });
  it('rejects cycle below minimum', () => {
    const result = validateRouteConfig({ cycleMinutes: TRADE_ROUTE_MIN_CYCLE - 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
  it('rejects cycle above maximum', () => {
    const result = validateRouteConfig({ cycleMinutes: TRADE_ROUTE_MAX_CYCLE + 1 });
    expect(result.valid).toBe(false);
  });
  it('rejects when at max route count', () => {
    const result = validateRouteConfig({ cycleMinutes: TRADE_ROUTE_MIN_CYCLE, routeCount: MAX_TRADE_ROUTES });
    expect(result.valid).toBe(false);
  });
  it('allows when below max route count', () => {
    const result = validateRouteConfig({ cycleMinutes: TRADE_ROUTE_MIN_CYCLE, routeCount: MAX_TRADE_ROUTES - 1 });
    expect(result.valid).toBe(true);
  });
});
```

**Step 2: Write worldgen tests**

Create `packages/server/src/engine/__tests__/worldgen.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashCoords, generateSector } from '../worldgen.js';

describe('hashCoords', () => {
  it('returns a number', () => {
    expect(typeof hashCoords(0, 0, 1234)).toBe('number');
  });
  it('is deterministic', () => {
    expect(hashCoords(5, 10, 9999)).toBe(hashCoords(5, 10, 9999));
  });
  it('produces different results for different inputs', () => {
    expect(hashCoords(1, 2, 1234)).not.toBe(hashCoords(2, 1, 1234));
    expect(hashCoords(1, 1, 1234)).not.toBe(hashCoords(-1, -1, 1234));
  });
  it('handles negative coordinates', () => {
    expect(() => hashCoords(-99, -99, 1234)).not.toThrow();
  });
});

describe('generateSector', () => {
  it('returns sector with correct coordinates', () => {
    const s = generateSector(3, -5, 'user1');
    expect(s.x).toBe(3);
    expect(s.y).toBe(-5);
  });
  it('is deterministic', () => {
    const a = generateSector(10, 20, null);
    const b = generateSector(10, 20, null);
    expect(a.type).toBe(b.type);
    expect(a.seed).toBe(b.seed);
  });
  it('returns a valid sector type', () => {
    const VALID_TYPES = ['empty', 'asteroid', 'nebula', 'station', 'anomaly', 'wormhole'];
    const s = generateSector(7, 7, null);
    expect(VALID_TYPES).toContain(s.type);
  });
  it('resources are non-negative', () => {
    const s = generateSector(42, 42, null);
    expect(s.resources.ore).toBeGreaterThanOrEqual(0);
    expect(s.resources.gas).toBeGreaterThanOrEqual(0);
    expect(s.resources.crystal).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/tradeRoutes.test.ts src/engine/__tests__/worldgen.test.ts
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/server/src/engine/__tests__/tradeRoutes.test.ts \
        packages/server/src/engine/__tests__/worldgen.test.ts
git commit -m "test: add tradeRoutes and worldgen unit tests (#46)"
```

---

### Task 2: Tests — comms edge cases + scanEvents

**Files:**
- Modify: `packages/server/src/engine/__tests__/comms.test.ts`
- Modify: `packages/server/src/engine/__tests__/scanEvents.test.ts`

**Step 1: Read existing comms and scanEvents tests**

Read both existing test files to see what's already covered.

```bash
cat packages/server/src/engine/__tests__/comms.test.ts
cat packages/server/src/engine/__tests__/scanEvents.test.ts
```

**Step 2: Read the source files to find untested functions**

```bash
grep -n "^export function" packages/server/src/engine/comms.ts
grep -n "^export function" packages/server/src/engine/scanEvents.ts
```

**Step 3: Add missing test cases**

For `comms.test.ts`, add tests for any untested edge cases (e.g. relay routing edge cases, empty relay chain, message filtering).

For `scanEvents.test.ts`, add tests for:
- `checkScanEvent` returns `hasEvent: false` for non-event sectors
- `checkScanEvent` returns an event with `eventType` for event sectors
- Event types match the known set: `pirate_ambush`, `distress_signal`, `anomaly_reading`, `artifact_find`

**Step 4: Run full server test suite**

```bash
cd packages/server && npx vitest run
```

All must pass. Fix any failures.

**Step 5: Commit**

```bash
git add packages/server/src/engine/__tests__/comms.test.ts \
        packages/server/src/engine/__tests__/scanEvents.test.ts
git commit -m "test: add edge case coverage for comms and scanEvents (#46)"
```

---

### Task 3: Playwright setup

**Files:**
- Create: `packages/client/playwright.config.ts`
- Create: `packages/client/e2e/helpers.ts`
- Modify: `packages/client/package.json` (add playwright dependency + script)

**Step 1: Install Playwright**

```bash
cd packages/client && npm install --save-dev @playwright/test
```

**Step 2: Create playwright config**

Create `packages/client/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3201',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3201',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

**Step 3: Add test script to package.json**

In `packages/client/package.json`, add to `"scripts"`:
```json
"test:e2e": "playwright test"
```

**Step 4: Create e2e helper**

Create `packages/client/e2e/helpers.ts`:

```ts
import type { Page } from '@playwright/test';

export async function loginAsGuest(page: Page) {
  await page.goto('/');
  await page.getByText('GAST SPIELEN').click();
  await page.waitForSelector('.desktop-layout-v2', { timeout: 15_000 });
}

export async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /EINLOGGEN|LOGIN/i }).click();
  await page.waitForSelector('.desktop-layout-v2', { timeout: 15_000 });
}
```

**Step 5: Install browsers**

```bash
cd packages/client && npx playwright install chromium
```

**Step 6: Verify config works**

```bash
cd packages/client && npx playwright test --list
```

Expected: no errors (test list can be empty at this point).

**Step 7: Commit**

```bash
git add packages/client/playwright.config.ts \
        packages/client/e2e/helpers.ts \
        packages/client/package.json
git commit -m "test: set up Playwright E2E test infrastructure (#46)"
```

---

### Task 4: Playwright E2E tests — Login + Sidebar

**Files:**
- Create: `packages/client/e2e/login.spec.ts`
- Create: `packages/client/e2e/sidebar.spec.ts`

**Note:** These E2E tests require the game server (localhost:2567) AND client (localhost:3201) to be running. They are **skipped in CI** but runnable locally. Add `test.skip` annotation with a reason if the server is not available, OR use `test.describe.configure({ mode: 'serial' })`.

**Step 1: Write login tests**

Create `packages/client/e2e/login.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers';

test.describe('Login screen', () => {
  test('shows login form on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByText('GAST SPIELEN')).toBeVisible();
  });

  test('guest login shows [GAST] badge in HUD', async ({ page }) => {
    await loginAsGuest(page);
    await expect(page.getByText('[GAST]')).toBeVisible();
  });

  test('HUD shows AP, FUEL, CR after login', async ({ page }) => {
    await loginAsGuest(page);
    await expect(page.getByText(/AP:/)).toBeVisible();
    await expect(page.getByText(/FUEL:/)).toBeVisible();
    await expect(page.getByText(/CR:/)).toBeVisible();
  });
});
```

**Step 2: Write sidebar toggle tests**

Create `packages/client/e2e/sidebar.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { loginAsGuest } from './helpers';

test.describe('Sidebar collapse', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
  });

  test('left sidebar collapses and expands', async ({ page }) => {
    const leftSidebar = page.locator('.sidebar-left');
    await expect(leftSidebar).not.toHaveClass(/collapsed/);

    // Click collapse button (◀)
    await page.locator('.sidebar-left .sidebar-toggle').click();
    await page.waitForTimeout(350); // wait for 250ms animation + buffer
    await expect(leftSidebar).toHaveClass(/collapsed/);

    // Click expand button (▶)
    await page.locator('.sidebar-left .sidebar-toggle').click();
    await page.waitForTimeout(350);
    await expect(leftSidebar).not.toHaveClass(/collapsed/);
  });

  test('right sidebar collapses independently', async ({ page }) => {
    const leftSidebar = page.locator('.sidebar-left');
    const rightSidebar = page.locator('.sidebar-right');

    await page.locator('.sidebar-right .sidebar-toggle').click();
    await page.waitForTimeout(350);

    await expect(rightSidebar).toHaveClass(/collapsed/);
    await expect(leftSidebar).not.toHaveClass(/collapsed/); // left unchanged
  });
});
```

**Step 3: Run E2E tests (requires running servers)**

```bash
cd packages/client && npx playwright test
```

If the game server is not running during this task, add `.skip` to the tests and note that they require live servers. The goal is that the tests are well-written and runnable — CI skipping is acceptable.

**Step 4: Run vitest unit tests to confirm nothing broken**

```bash
cd packages/client && npx vitest run
```

**Step 5: Commit**

```bash
git add packages/client/e2e/login.spec.ts \
        packages/client/e2e/sidebar.spec.ts
git commit -m "test: add Playwright E2E tests for login and sidebar (#46)"
```

---

### Task 5: Cheat protection Level 1 — Input validation

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Background:** Currently the server trusts client data like `{ x, y }` for jumps without validating adjacency, and `{ resource, amount }` for trades without validating amounts are positive integers. This task adds validation guards.

**Step 1: Read SectorRoom message handlers**

Read `packages/server/src/rooms/SectorRoom.ts` to understand the existing handler structure. Focus on:
- `handleJump` — does it validate dx/dy ≤ jump range?
- `handleMine` — does it validate resource type?
- `placeOrder` handler — does it validate amount > 0?
- `handleTransfer` handler — does it validate amount bounds?

**Step 2: Add a validation helper at the top of the class**

Find a good place near the top of the `SectorRoom` class body (after the `onCreate` method or similar) to add:

```ts
private validateInt(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

private validateString(value: unknown, allowedValues: string[]): string | null {
  if (typeof value !== 'string') return null;
  return allowedValues.includes(value) ? value : null;
}
```

**Step 3: Harden `handleJump`**

In `handleJump`, add at the top (before any other logic):
```ts
const targetX = this.validateInt(data.x, -9999, 9999);
const targetY = this.validateInt(data.y, -9999, 9999);
if (targetX === null || targetY === null) {
  client.send('error', { code: 'INVALID_INPUT', message: 'Invalid jump coordinates' });
  return;
}
```
Then replace uses of `data.x`/`data.y` with `targetX`/`targetY`.

**Step 4: Harden `handleMine` / `handleStartMine`**

Add resource type validation:
```ts
const VALID_RESOURCES = ['ore', 'gas', 'crystal'];
const resource = this.validateString(data.resource, VALID_RESOURCES);
if (!resource) {
  client.send('error', { code: 'INVALID_INPUT', message: 'Invalid resource type' });
  return;
}
```

**Step 5: Harden `placeOrder` / trade handlers**

For any `amount` field:
```ts
const amount = this.validateInt(data.amount, 1, 99999);
if (amount === null) {
  client.send('error', { code: 'INVALID_INPUT', message: 'Invalid amount' });
  return;
}
```

**Step 6: Harden `handleTransfer` (cargo transfer)**

Validate: `amount > 0`, target coordinates are adjacent (same sector or 1 away).

**Step 7: Run server tests**

```bash
cd packages/server && npx vitest run
```

All 168+ tests must pass.

**Step 8: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: cheat protection level 1 — server-side input validation (#47)"
```

---

### Task 6: Cheat protection Level 2 — Rate limiting

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Goal:** Prevent action spam. Limit: max 5 game actions per second per player. Actions include: jump, scan, mine (start/stop), transfer, build, trade.

**Step 1: Add rate limit tracking**

In `SectorRoom`, add a per-session rate limit map (in `onCreate` or as a class field):

```ts
private actionTimestamps = new Map<string, number[]>(); // sessionId → timestamps

private checkRateLimit(sessionId: string, maxPerSecond = 5): boolean {
  const now = Date.now();
  const window = 1000; // 1 second
  const timestamps = this.actionTimestamps.get(sessionId) ?? [];
  const recent = timestamps.filter(t => now - t < window);
  if (recent.length >= maxPerSecond) return false;
  recent.push(now);
  this.actionTimestamps.set(sessionId, recent);
  return true;
}
```

Clean up on `onLeave`:
```ts
this.actionTimestamps.delete(client.sessionId);
```

**Step 2: Apply rate limit to heavy-use handlers**

At the top of these handlers (after the guest check, before any DB queries):
```ts
if (!this.checkRateLimit(client.sessionId)) {
  client.send('error', { code: 'RATE_LIMITED', message: 'Zu viele Aktionen — bitte langsamer' });
  return;
}
```

Apply to: `handleJump`, `handleScan`, `handleMine`, `handleBuild`, `placeOrder`, `handleTransfer`.

**Step 3: Add anomaly logging**

Create `packages/server/src/engine/cheatLog.ts`:

```ts
export interface AnomalyEvent {
  userId: string;
  action: string;
  reason: string;
  details: Record<string, unknown>;
  timestamp: number;
}

const anomalyLog: AnomalyEvent[] = []; // in-memory for now (future: persist to DB)

export function logAnomaly(event: Omit<AnomalyEvent, 'timestamp'>) {
  anomalyLog.push({ ...event, timestamp: Date.now() });
  console.warn(`[ANOMALY] ${event.userId} — ${event.action}: ${event.reason}`, event.details);
}

export function getRecentAnomalies(userId: string, windowMs = 60_000): AnomalyEvent[] {
  const cutoff = Date.now() - windowMs;
  return anomalyLog.filter(e => e.userId === userId && e.timestamp > cutoff);
}
```

**Step 4: Log anomalies on rate limit hits**

In `checkRateLimit`, when limit is exceeded:
```ts
import { logAnomaly } from '../engine/cheatLog.js';
// ...
logAnomaly({ userId: client.auth?.userId ?? sessionId, action: 'rate_limit', reason: 'Too many actions', details: { count: recent.length } });
```

**Step 5: Run server tests**

```bash
cd packages/server && npx vitest run
```

All tests pass.

**Step 6: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts \
        packages/server/src/engine/cheatLog.ts
git commit -m "feat: cheat protection level 2 — rate limiting and anomaly logging (#47)"
```

---

### Task 7: Close issues + run full suite + push

**Step 1: Run full test suite**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

All must pass.

**Step 2: Close issues**

```bash
gh issue close 46 --comment "Done: tradeRoutes + worldgen + comms + scanEvents tests added, Playwright E2E setup"
gh issue close 47 --comment "Done: Level 1 input validation + Level 2 rate limiting + anomaly logging"
```

**Step 3: Push**

```bash
git push -u origin fix/quality-sprint
```
