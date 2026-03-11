import { test, expect } from '@playwright/test';

test('Admin QUAD-MAP bookmarks show civilizations', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  await page.setViewportSize({ width: 1920, height: 1000 });

  // Step 1: Navigate to admin page
  await page.goto('http://localhost:2567/admin');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'playtest-admin-01-initial.png' });
  console.log('=== Step 1: Admin page loaded ===');

  // Step 2: Enter token and authenticate
  const tokenInput = page.locator('input[type="password"]');
  await tokenInput.fill('voidsector-admin-dev');
  await page.locator('button').filter({ hasText: /auth/i }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'playtest-admin-02-authenticated.png' });
  console.log('=== Step 2: Authenticated ===');

  // Step 3: Click QUAD-MAP tab (use exact text match)
  const allTabs = page.locator('.tab');
  const tabCount = await allTabs.count();
  console.log(`Tabs found: ${tabCount}`);
  for (let i = 0; i < tabCount; i++) {
    const text = await allTabs.nth(i).textContent();
    console.log(`  Tab ${i}: "${text?.trim()}"`);
    if (text?.trim().includes('QUAD-MAP')) {
      await allTabs.nth(i).click();
      console.log('  -> Clicked QUAD-MAP tab');
    }
  }

  // If no .tab class, try buttons/links with QUAD-MAP text
  if (tabCount === 0) {
    const qmapLink = page.locator('a, button, [onclick]').filter({ hasText: 'QUAD-MAP' });
    if (await qmapLink.count() > 0) {
      await qmapLink.first().click();
      console.log('Clicked QUAD-MAP link/button');
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'playtest-admin-03-qmap-tab.png' });
  console.log('=== Step 3: QUAD-MAP tab clicked ===');

  // Step 4: Check bookmarks sidebar
  const bookmarksContainer = page.locator('#qmap-bookmarks');
  const bookmarkChildren = bookmarksContainer.locator('> *');
  const bmCount = await bookmarkChildren.count();
  console.log(`Bookmarks in #qmap-bookmarks: ${bmCount}`);

  for (let i = 0; i < bmCount; i++) {
    const text = await bookmarkChildren.nth(i).textContent();
    console.log(`  Bookmark ${i}: "${text?.trim().replace(/\n/g, ' | ')}"`);
  }

  // Step 5: Check if faction names are visible
  const factions = ['HUMAN', 'ARCHIVISTS', 'CONSORTIUM', 'KTHARI', 'MIRROR_MINDS', 'MYCELIANS', 'SILENT_SWARM', 'TOURIST_GUILD'];
  const bookmarkText = await bookmarksContainer.textContent() ?? '';
  console.log('\n=== Faction bookmark check ===');
  for (const f of factions) {
    const found = bookmarkText.toUpperCase().includes(f);
    console.log(`  ${f}: ${found ? 'FOUND' : 'MISSING'}`);
  }

  // Step 6: Click on a few bookmarks and check canvas navigation
  const qmapCanvas = page.locator('#qmap-canvas');
  const canvasBox = await qmapCanvas.boundingBox();
  console.log(`\nCanvas: ${canvasBox?.width}x${canvasBox?.height}`);

  if (bmCount > 0) {
    // Click first faction bookmark
    await bookmarkChildren.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'playtest-admin-04-bookmark-first.png' });
    console.log('=== Step 4: First bookmark clicked ===');

    // Click a middle bookmark
    if (bmCount > 3) {
      await bookmarkChildren.nth(3).click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'playtest-admin-05-bookmark-mid.png' });
      const midText = await bookmarkChildren.nth(3).textContent();
      console.log(`=== Step 5: Bookmark 3 clicked: "${midText?.trim()}" ===`);
    }

    // Click last bookmark
    if (bmCount > 1) {
      await bookmarkChildren.nth(bmCount - 1).click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'playtest-admin-06-bookmark-last.png' });
      const lastText = await bookmarkChildren.nth(bmCount - 1).textContent();
      console.log(`=== Step 6: Last bookmark clicked: "${lastText?.trim()}" ===`);
    }
  }

  // Step 7: Check fullscreen button exists
  const fullscreenBtn = page.locator('#qmap-fullscreen-btn');
  console.log(`\nFullscreen button: ${await fullscreenBtn.count() > 0 ? 'EXISTS' : 'MISSING'}`);

  // Step 8: Check zoom buttons
  const zoomBtns = page.locator('#qmap-controls button, [id*="qmap"] button');
  const zoomCount = await zoomBtns.count();
  console.log(`Zoom/control buttons: ${zoomCount}`);
  for (let i = 0; i < zoomCount; i++) {
    const text = await zoomBtns.nth(i).textContent();
    console.log(`  Control ${i}: "${text?.trim()}"`);
  }

  await page.screenshot({ path: 'playtest-admin-07-final.png' });
  console.log('\n=== Playtest complete ===');
});
