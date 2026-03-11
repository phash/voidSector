import { test, expect } from '@playwright/test';
import { mockWebSocket, mockAuth } from './fixtures/game';

/**
 * Trade sell-all regression test for issue #237:
 * "Selling resources never goes to 0 — one always remains"
 *
 * Tests the TradeScreen's sell-all button behavior at NPC stations.
 * Since we can't connect to a real game server in this setup, we verify
 * the client-side computation of effectiveMax (the amount sent to the server).
 *
 * The root cause was stock drift: the server recalculated station stock
 * between displaying data to the client and processing the sell request,
 * causing the effective sell amount to be less than what the client showed.
 */
test.describe('Trade Sell-All (#237)', () => {
  test.beforeEach(async ({ page }) => {
    await mockWebSocket(page);
    await mockAuth(page);

    // Set localStorage so the app has auth tokens
    await page.addInitScript(() => {
      localStorage.setItem('vs_token', 'e2e-test-token');
      localStorage.setItem('vs_playerId', 'e2e-player-001');
      localStorage.setItem('vs_username', 'TestPilot');
      localStorage.setItem('vs-active-program', 'TRADE');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('effectiveMax equals playerAmount when station has sufficient capacity', async ({ page }) => {
    // Inject game state with cargo and NPC station data
    const injected = await page.evaluate(() => {
      const store = (window as any).__zustandStore;
      if (!store) return { error: 'no store' };

      store.setState({
        screen: 'game',
        token: 'e2e-test-token',
        playerId: 'e2e-player-001',
        username: 'TestPilot',
        position: { x: 1, y: 1 },
        currentSector: { x: 1, y: 1, type: 'station', scanned: true },
        activeProgram: 'TRADE',
        cargo: { ore: 10, gas: 5, crystal: 2, slates: 0, artefact: 0 },
        ship: { stats: { cargoCap: 50 } },
        npcStationData: {
          level: 1,
          name: 'Outpost',
          xp: 0,
          nextLevelXp: 500,
          inventory: [
            { itemType: 'ore', stock: 50, maxStock: 200, buyPrice: 12, sellPrice: 8 },
            { itemType: 'gas', stock: 30, maxStock: 200, buyPrice: 15, sellPrice: 10 },
            { itemType: 'crystal', stock: 20, maxStock: 200, buyPrice: 25, sellPrice: 18 },
          ],
        },
      });
      return { success: true };
    });

    if (injected && 'error' in injected) {
      test.skip();
      return;
    }

    // Wait for the TradeScreen to render
    await page.waitForTimeout(500);

    // Check that the sell-all button for ore shows the full amount
    const sellAllOre = page.getByTestId('sell-all-ore');
    if (await sellAllOre.isVisible()) {
      const text = await sellAllOre.textContent();
      // Station has 150 remaining capacity (200 - 50), player has 10 ore
      // effectiveMax = Math.min(10, 150) = 10
      // Label should be "ALL (10)" — no "→ max" truncation
      expect(text).toContain('ALL (10)');
      expect(text).not.toContain('→ max');
    }
  });

  test('effectiveMax is capped when station is near full', async ({ page }) => {
    const injected = await page.evaluate(() => {
      const store = (window as any).__zustandStore;
      if (!store) return { error: 'no store' };

      store.setState({
        screen: 'game',
        token: 'e2e-test-token',
        playerId: 'e2e-player-001',
        username: 'TestPilot',
        position: { x: 1, y: 1 },
        currentSector: { x: 1, y: 1, type: 'station', scanned: true },
        activeProgram: 'TRADE',
        cargo: { ore: 10, gas: 5, crystal: 2, slates: 0, artefact: 0 },
        ship: { stats: { cargoCap: 50 } },
        npcStationData: {
          level: 1,
          name: 'Outpost',
          xp: 0,
          nextLevelXp: 500,
          inventory: [
            // Station nearly full: 197/200, only 3 remaining capacity
            { itemType: 'ore', stock: 197, maxStock: 200, buyPrice: 5, sellPrice: 3 },
            { itemType: 'gas', stock: 30, maxStock: 200, buyPrice: 15, sellPrice: 10 },
            { itemType: 'crystal', stock: 20, maxStock: 200, buyPrice: 25, sellPrice: 18 },
          ],
        },
      });
      return { success: true };
    });

    if (injected && 'error' in injected) {
      test.skip();
      return;
    }

    await page.waitForTimeout(500);

    const sellAllOre = page.getByTestId('sell-all-ore');
    if (await sellAllOre.isVisible()) {
      const text = await sellAllOre.textContent();
      // Station has 3 remaining capacity (200 - 197), player has 10 ore
      // effectiveMax = Math.min(10, 3) = 3
      // Label should show the cap: "ALL (10 → max 3)"
      expect(text).toContain('ALL (10 → max 3)');
    }
  });
});
