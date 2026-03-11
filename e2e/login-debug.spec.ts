import { test, expect } from '@playwright/test';

test('Debug nav-map right side rendering', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // Use a wide viewport to match user's screen
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('http://localhost:3201');
  await page.waitForTimeout(2000);

  await page.fill('input[placeholder="USERNAME"]', 'Phash');
  await page.fill('input[placeholder="PASSWORD"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Get canvas dimensions and DPR info
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas found' };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    const transform = ctx?.getTransform();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      dpr,
      transformA: transform?.a,
      transformD: transform?.d,
      parentWidth: canvas.parentElement?.getBoundingClientRect().width,
      parentHeight: canvas.parentElement?.getBoundingClientRect().height,
    };
  });
  console.log('=== CANVAS INFO ===');
  console.log(JSON.stringify(canvasInfo, null, 2));

  // Check what's drawn on the canvas - sample pixels across the width
  const pixelSamples = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return [];
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    const h = canvas.height;
    const w = canvas.width;
    const midY = Math.floor(h / 2);
    const samples: { x: number, pct: string, r: number, g: number, b: number, a: number }[] = [];
    // Sample 20 points across the width at mid-height
    for (let i = 0; i < 20; i++) {
      const x = Math.floor((i / 19) * (w - 1));
      const pixel = ctx.getImageData(x, midY, 1, 1).data;
      samples.push({
        x,
        pct: `${Math.round(x / w * 100)}%`,
        r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3],
      });
    }
    return samples;
  });
  console.log('=== PIXEL SAMPLES (mid-height, across width) ===');
  for (const s of pixelSamples) {
    const color = s.r === 0 && s.g === 0 && s.b === 0 ? 'BLACK' :
                  s.r === 5 && s.g === 5 && s.b === 5 ? 'BG(#050505)' :
                  `rgb(${s.r},${s.g},${s.b})`;
    console.log(`  x=${s.x} (${s.pct}): ${color} a=${s.a}`);
  }

  // Check what section 2 (main monitor) dimensions are
  const sec2Info = await page.evaluate(() => {
    const sec2 = document.getElementById('cockpit-sec2');
    if (!sec2) return { error: 'no cockpit-sec2' };
    const rect = sec2.getBoundingClientRect();
    const canvas = sec2.querySelector('canvas');
    const canvasRect = canvas?.getBoundingClientRect();
    return {
      sec2: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      canvas: canvasRect ? { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height } : null,
    };
  });
  console.log('=== SEC2 / CANVAS LAYOUT ===');
  console.log(JSON.stringify(sec2Info, null, 2));

  // Get the drawRadar internal state by injecting a debug probe
  const radarDebug = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const FRAME_LEFT = 40;
    const FRAME_PAD = 8;
    const FRAME_BOTTOM = 24;
    const CELL_SIZES = [
      { w: 48, h: 38 },
      { w: 64, h: 50 },
      { w: 80, h: 64 },
      { w: 96, h: 76 },
    ];
    // Try each zoom level
    const results: any[] = [];
    for (let z = 0; z < 4; z++) {
      const cw = CELL_SIZES[z].w;
      const ch = CELL_SIZES[z].h;
      const gridLeft = FRAME_LEFT;
      const gridTop = FRAME_PAD;
      const gridRight = w - FRAME_PAD;
      const gridBottom = h - FRAME_BOTTOM;
      const gridW = gridRight - gridLeft;
      const gridH = gridBottom - gridTop;
      const visibleCols = Math.max(1, Math.floor(gridW / cw));
      const visibleRows = Math.max(1, Math.floor(gridH / ch));
      const radiusX = Math.floor(visibleCols / 2);
      const radiusY = Math.floor(visibleRows / 2);
      const gridCenterX = gridLeft + gridW / 2;
      const gridCenterY = gridTop + gridH / 2;
      const totalCellsW = (2 * radiusX + 1) * cw;
      const rightmostCellX = gridCenterX + radiusX * cw + cw / 2;
      results.push({
        zoom: z,
        cellW: cw,
        canvasW: w,
        canvasH: h,
        gridW,
        gridCenterX,
        visibleCols,
        radiusX,
        totalCellsW,
        rightmostCellEdge: rightmostCellX,
        gridRight,
        overflow: rightmostCellX > w ? 'OVERFLOW!' : 'ok',
      });
    }
    return results;
  });
  console.log('=== RADAR GRID CALCULATIONS ===');
  for (const r of radarDebug) {
    console.log(`  Zoom ${r.zoom}: canvas=${r.canvasW}px, gridW=${r.gridW}px, center=${r.gridCenterX}px, cols=${r.visibleCols}, radiusX=${r.radiusX}, rightEdge=${r.rightmostCellEdge}px vs gridRight=${r.gridRight}px — ${r.overflow}`);
  }

  await page.screenshot({ path: 'playtest-navmap-debug.png', fullPage: false });
  console.log('=== Screenshot saved ===');
});
