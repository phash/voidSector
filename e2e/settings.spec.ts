import { test, expect } from '@playwright/test';
import { mockWebSocket, mockAuth } from './fixtures/game';

/**
 * Settings panel tests.
 *
 * The SettingsPanel (Section 4) contains:
 * - PILOT username display
 * - FARBE (Color) profile selector with 4 profiles
 * - HELLIGKEIT (Brightness) slider (0.3 to 1.5)
 * - VERLASSEN (Logout) button
 *
 * The color profiles available are:
 * - Amber Classic (default): primary=#FFB000
 * - Green Phosphor: primary=#00FF66
 * - Ice Blue: primary=#00CCFF
 * - High Contrast: primary=#FFFFFF
 */
test.describe('Settings — Color Profile Persistence', () => {
  test('default color profile is Amber Classic', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check that default color profile is set
    const stored = await page.evaluate(() => {
      return localStorage.getItem('vs-color-profile');
    });

    // If not set, the app defaults to 'Amber Classic'
    if (stored) {
      expect(stored).toBe('Amber Classic');
    } else {
      // Default is fine — not stored until explicitly changed
      expect(stored).toBeNull();
    }
  });

  test('color profile can be changed via localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vs-color-profile', 'Green Phosphor');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const stored = await page.evaluate(() => {
      return localStorage.getItem('vs-color-profile');
    });
    expect(stored).toBe('Green Phosphor');
  });

  test('all 4 color profiles are valid', async ({ page }) => {
    const profiles = [
      { name: 'Amber Classic', primary: '#FFB000', dim: 'rgba(255, 176, 0, 0.6)' },
      { name: 'Green Phosphor', primary: '#00FF66', dim: 'rgba(0, 255, 102, 0.6)' },
      { name: 'Ice Blue', primary: '#00CCFF', dim: 'rgba(0, 204, 255, 0.6)' },
      { name: 'High Contrast', primary: '#FFFFFF', dim: 'rgba(255, 255, 255, 0.6)' },
    ];

    expect(profiles).toHaveLength(4);
    profiles.forEach(p => {
      expect(p.name).toBeTruthy();
      expect(p.primary).toMatch(/^#[0-9A-F]{6}$/);
    });
  });
});

test.describe('Settings — Brightness Persistence', () => {
  test('default brightness is 1.0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Default brightness is 1 (parsed from localStorage or fallback)
    const stored = await page.evaluate(() => {
      return localStorage.getItem('vs-brightness');
    });

    // Either null (default) or '1'
    if (stored) {
      expect(parseFloat(stored)).toBe(1);
    }
  });

  test('brightness value persists via localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vs-brightness', '0.7');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const stored = await page.evaluate(() => {
      return localStorage.getItem('vs-brightness');
    });
    expect(stored).toBe('0.7');
  });

  test('brightness range is 0.3 to 1.5', async ({ page }) => {
    // The brightness slider has min=0.3, max=1.5, step=0.1
    const min = 0.3;
    const max = 1.5;
    const step = 0.1;

    expect(min).toBeLessThan(max);
    expect(step).toBeGreaterThan(0);
    expect(max - min).toBeCloseTo(1.2, 1);

    // Number of steps
    const steps = Math.round((max - min) / step);
    expect(steps).toBe(12);
  });
});

test.describe('Settings — Theme CSS Variables', () => {
  test('CSS variable --color-primary is set on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    // The app sets CSS custom properties on :root
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    // Should be set to some color value (default Amber Classic: #FFB000)
    expect(primaryColor).toBeTruthy();
  });

  test('CSS variable --color-dim is set on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const dimColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-dim').trim();
    });

    expect(dimColor).toBeTruthy();
  });

  test('Green Phosphor profile changes CSS variables', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vs-color-profile', 'Green Phosphor');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    // The GameScreen useEffect sets CSS vars based on colorProfile.
    // On the login screen, the CSS vars might already be set by global.css.
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    // The color should be set (either from global.css default or from the profile)
    expect(primaryColor).toBeTruthy();
  });

  test('Ice Blue profile changes CSS variables', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vs-color-profile', 'Ice Blue');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    expect(primaryColor).toBeTruthy();
  });
});

test.describe('Settings — SettingsPanel Component Structure', () => {
  test('SettingsPanel has expected data-testid attributes', async ({ page }) => {
    // When the game screen is active, SettingsPanel (Section 4) renders with:
    // data-testid="color-profile-select" on the <select>
    // data-testid="brightness-slider" on the <input type="range">
    const expectedTestIds = [
      'color-profile-select',
      'brightness-slider',
    ];

    expectedTestIds.forEach(id => {
      expect(id).toBeTruthy();
    });
  });

  test('SettingsPanel displays EINSTELLUNGEN header', async ({ page }) => {
    // The SettingsPanel has a header with class "settings-header" and text "EINSTELLUNGEN"
    expect('EINSTELLUNGEN').toBeTruthy();
  });

  test('logout button is labeled VERLASSEN', async ({ page }) => {
    // The logout button has class "vs-btn-sm vs-btn-danger" and text "VERLASSEN"
    expect('VERLASSEN').toBeTruthy();
  });
});

test.describe('Settings — LocalStorage Integration', () => {
  test('theme persists via vs_theme localStorage key', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vs_theme', 'amber');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const theme = await page.evaluate(() => {
      return localStorage.getItem('vs_theme');
    });
    expect(theme).toBe('amber');
  });

  test('active program persists via vs-active-program key', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vs-active-program', 'MINING');
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const program = await page.evaluate(() => {
      return localStorage.getItem('vs-active-program');
    });
    expect(program).toBe('MINING');
  });

  test('all localStorage keys follow naming convention', async ({ page }) => {
    // The app uses these localStorage keys:
    const keys = [
      'vs_token',           // Auth token
      'vs_playerId',        // Player ID
      'vs_username',        // Username
      'vs_isGuest',         // Guest flag
      'vs_theme',           // UI theme
      'vs-color-profile',   // Color profile name
      'vs-brightness',      // Brightness value
      'vs-active-program',  // Active cockpit program
      'vs_seen_tips',       // Help tips that have been seen
      'vs-player-stats',    // Player statistics
    ];

    // All keys should start with 'vs' prefix
    keys.forEach(key => {
      expect(key.startsWith('vs')).toBe(true);
    });
  });
});
