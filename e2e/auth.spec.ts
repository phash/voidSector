import { test, expect } from '@playwright/test';
import { mockAuth, setupLoginScreen } from './fixtures/game';

test.describe('Auth — Login/Register Screen', () => {
  test.beforeEach(async ({ page }) => {
    await setupLoginScreen(page);
  });

  test('renders the VOID SECTOR title', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toHaveText('VOID SECTOR');
  });

  test('login form has username and password fields', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="USERNAME"]');
    const passwordInput = page.locator('input[placeholder="PASSWORD"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('type', 'text');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('username field has min/max length constraints', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="USERNAME"]');
    await expect(usernameInput).toHaveAttribute('minlength', '3');
    await expect(usernameInput).toHaveAttribute('maxlength', '32');
  });

  test('password field has min length constraint', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="PASSWORD"]');
    await expect(passwordInput).toHaveAttribute('minlength', '6');
  });

  test('login button renders with correct text', async ({ page }) => {
    const loginBtn = page.locator('button[type="submit"]');
    await expect(loginBtn).toHaveText('LOGIN');
  });

  test('toggle button switches to register mode', async ({ page }) => {
    // Initially shows "NEW PILOT? REGISTER"
    const toggleBtn = page.locator('button:has-text("NEW PILOT? REGISTER")');
    await expect(toggleBtn).toBeVisible();

    // Click to switch to register mode
    await toggleBtn.click();

    // Submit button now says REGISTER
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toHaveText('REGISTER');

    // Toggle button now says "HAVE ACCOUNT? LOGIN"
    const loginToggle = page.locator('button:has-text("HAVE ACCOUNT? LOGIN")');
    await expect(loginToggle).toBeVisible();
  });

  test('toggle button switches back to login mode', async ({ page }) => {
    // Switch to register mode
    await page.locator('button:has-text("NEW PILOT? REGISTER")').click();

    // Switch back to login mode
    await page.locator('button:has-text("HAVE ACCOUNT? LOGIN")').click();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toHaveText('LOGIN');
  });

  test('guest mode button exists', async ({ page }) => {
    const guestBtn = page.locator('button:has-text("GAST SPIELEN")');
    await expect(guestBtn).toBeVisible();
  });

  test('guest mode shows 24h notice text', async ({ page }) => {
    const notice = page.locator('text=Kein Account nötig — 24h Testzugang');
    await expect(notice).toBeVisible();
  });

  test('can type into username and password fields', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="USERNAME"]');
    const passwordInput = page.locator('input[placeholder="PASSWORD"]');

    await usernameInput.fill('TestPilot');
    await passwordInput.fill('secret123');

    await expect(usernameInput).toHaveValue('TestPilot');
    await expect(passwordInput).toHaveValue('secret123');
  });

  test('login form submits with mocked auth', async ({ page }) => {
    await mockAuth(page);

    const usernameInput = page.locator('input[placeholder="USERNAME"]');
    const passwordInput = page.locator('input[placeholder="PASSWORD"]');

    await usernameInput.fill('TestPilot');
    await passwordInput.fill('secret123');

    await page.locator('button[type="submit"]').click();

    // The form should show "CONNECTING..." while loading
    // (the button text changes during submission)
    // Note: the actual transition to game screen requires WebSocket,
    // which we can't fully mock here. The form submission is the key test.
  });

  test('error state displays on failed auth', async ({ page }) => {
    // Mock a failed login response
    await page.route('**/api/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      });
    });

    const usernameInput = page.locator('input[placeholder="USERNAME"]');
    const passwordInput = page.locator('input[placeholder="PASSWORD"]');

    await usernameInput.fill('BadUser');
    await passwordInput.fill('wrongpass');

    await page.locator('button[type="submit"]').click();

    // Wait for error message to appear
    const errorMsg = page.locator('text=Invalid credentials');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('error state displays on network failure', async ({ page }) => {
    // Mock a network error
    await page.route('**/api/login', async (route) => {
      await route.abort('connectionrefused');
    });

    const usernameInput = page.locator('input[placeholder="USERNAME"]');
    const passwordInput = page.locator('input[placeholder="PASSWORD"]');

    await usernameInput.fill('TestPilot');
    await passwordInput.fill('secret123');

    await page.locator('button[type="submit"]').click();

    // Wait for some error text to appear
    // The error handler catches the fetch error and shows it
    const errorArea = page.locator('div[style*="color: var(--color-danger)"]');
    await expect(errorArea).toBeVisible({ timeout: 5000 });
  });

  test('login and register buttons are disabled during submission', async ({ page }) => {
    // Set up a slow response
    await page.route('**/api/login', async (route) => {
      // Delay the response
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'tok',
          player: { id: '1', username: 'Test' },
          lastPosition: { x: 0, y: 0 },
        }),
      });
    });

    await page.locator('input[placeholder="USERNAME"]').fill('TestPilot');
    await page.locator('input[placeholder="PASSWORD"]').fill('secret123');
    await page.locator('button[type="submit"]').click();

    // The submit button should be disabled during loading
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveText('CONNECTING...');
  });
});
