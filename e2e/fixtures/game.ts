import { test as base, type Page } from '@playwright/test';

/**
 * Mock auth API responses — intercepts /api/login and /api/register
 * so the client receives a fake token and player data without a running server.
 */
export async function mockAuth(page: Page) {
  const mockResponse = {
    token: 'e2e-test-token-abc123',
    player: {
      id: 'e2e-player-001',
      username: 'TestPilot',
    },
    lastPosition: { x: 0, y: 0 },
  };

  await page.route('**/api/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    });
  });

  await page.route('**/api/register', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    });
  });

  await page.route('**/api/guest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...mockResponse,
        player: { id: 'e2e-guest-001', username: 'Guest_001' },
      }),
    });
  });
}

/**
 * Mock WebSocket connections — prevents Colyseus from trying to connect.
 * Intercepts any WS upgrade requests with a no-op.
 */
export async function mockWebSocket(page: Page) {
  await page.addInitScript(() => {
    // Replace the global WebSocket to prevent real connections
    const OriginalWS = window.WebSocket;
    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      CONNECTING = 0;
      OPEN = 1;
      CLOSING = 2;
      CLOSED = 3;

      readyState = 0;
      url: string;
      protocol = '';
      extensions = '';
      bufferedAmount = 0;
      binaryType: BinaryType = 'blob';
      onopen: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;

      constructor(url: string | URL, protocols?: string | string[]) {
        super();
        this.url = typeof url === 'string' ? url : url.toString();
        // Do not actually connect
      }

      send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        // no-op
      }

      close(_code?: number, _reason?: string) {
        this.readyState = 3;
      }
    }
    (window as any).WebSocket = MockWebSocket;
  });
}

/**
 * Set the Zustand store to the "game" screen state, bypassing login/WebSocket.
 * This directly injects state so we can test game UI without a server.
 */
export async function setGameState(page: Page, overrides: Record<string, unknown> = {}) {
  await page.evaluate((stateOverrides) => {
    const store = (window as any).__zustandStore;
    if (store) {
      store.setState({
        screen: 'game',
        token: 'e2e-test-token',
        playerId: 'e2e-player-001',
        username: 'TestPilot',
        position: { x: 5, y: 3 },
        ap: { current: 80, max: 100, regenPerSecond: 0.1, lastTick: Date.now() },
        fuel: { current: 45, max: 50 },
        credits: 1250,
        cargo: { ore: 10, gas: 5, crystal: 2, slates: 0, artefact: 1 },
        currentSector: { x: 5, y: 3, type: 'empty', scanned: true },
        activeProgram: 'NAV-COM',
        currentQuadrant: { qx: 0, qy: 0, name: 'Alpha Sector' },
        ...stateOverrides,
      });
    }
  }, overrides);
}

/**
 * Click a program button in the Program Selector (Section 1).
 */
export async function selectProgram(page: Page, programId: string) {
  await page.click(`[data-testid="program-btn-${programId}"]`);
}

/**
 * Wait for specific text to appear in the main monitor area.
 */
export async function waitForMonitor(page: Page, text: string) {
  await page.waitForSelector(`.cockpit-sec2:has-text("${text}")`, { timeout: 5000 });
}

/**
 * Expose the Zustand store on the window object for E2E test manipulation.
 * This init script must run before the app loads.
 */
export async function exposeStore(page: Page) {
  await page.addInitScript(() => {
    // The store will be attached by the app's dev-mode bootstrap.
    // We also provide a fallback mechanism: intercept zustand's create call.
    const origDefineProperty = Object.defineProperty;
    Object.defineProperty = function (obj: any, prop: string, descriptor: PropertyDescriptor) {
      const result = origDefineProperty.call(this, obj, prop, descriptor);
      // Zustand stores expose getState/setState — detect and capture
      if (prop === 'getState' && descriptor.value && typeof descriptor.value === 'function') {
        (window as any).__zustandStore = obj;
      }
      return result;
    };

    // Simpler approach: poll for the store after React mounts
    const interval = setInterval(() => {
      // Zustand stores created with `create()` are available on the module scope.
      // We look for __ZUSTAND_STORE__ which we set in our dev entry.
      if ((window as any).__zustandStore) {
        clearInterval(interval);
      }
    }, 50);

    // Auto-clear after 10s to not leak
    setTimeout(() => clearInterval(interval), 10000);
  });
}

/**
 * Navigate to the app and set up the game state for testing game UI.
 * This is the main setup helper for most E2E tests.
 */
export async function setupGameScreen(page: Page, stateOverrides: Record<string, unknown> = {}) {
  await mockWebSocket(page);
  await mockAuth(page);
  await page.goto('/');

  // Wait for React to mount
  await page.waitForSelector('h1', { timeout: 10000 });

  // Inject the store reference via the app's module system
  await page.evaluate(() => {
    // Access the store through React's internals or through window exposure
    // The app exposes useStore — we need to access its internal store
    const rootEl = document.getElementById('root') || document.querySelector('[data-reactroot]');
    if (!rootEl) return;

    // Try to find the store through React fiber
    const key = Object.keys(rootEl).find(k => k.startsWith('__reactFiber'));
    if (!key) return;

    let fiber = (rootEl as any)[key];
    let attempts = 0;
    while (fiber && attempts < 100) {
      if (fiber.memoizedState?.queue?.lastRenderedState?.setScreen) {
        (window as any).__zustandStore = {
          setState: (state: any) => {
            fiber.memoizedState.queue.lastRenderedState.setScreen?.('game');
          },
          getState: () => fiber.memoizedState.queue.lastRenderedState,
        };
        break;
      }
      fiber = fiber.return;
      attempts++;
    }
  });

  // Alternative: directly manipulate the DOM store by dispatching state changes
  // through the app. Set screen to 'game' and inject test state.
  await page.evaluate((overrides) => {
    // Zustand stores use useSyncExternalStore under the hood.
    // The simplest way to set state is through localStorage + reload,
    // or through direct zustand api if exposed.
    //
    // Set localStorage values that the store reads on init:
    localStorage.setItem('vs_token', 'e2e-test-token');
    localStorage.setItem('vs_playerId', 'e2e-player-001');
    localStorage.setItem('vs_username', 'TestPilot');
    localStorage.setItem('vs-active-program', overrides.activeProgram as string || 'NAV-COM');
  }, stateOverrides);

  // Reload so the store picks up localStorage values
  await page.reload();

  // Wait for the app to load with the token set (it will try to connect to server,
  // but WebSocket is mocked so it won't crash)
  await page.waitForSelector('h1', { timeout: 10000 });
}

/**
 * Set up the login screen for testing auth UI.
 */
export async function setupLoginScreen(page: Page) {
  await mockAuth(page);
  await page.goto('/');
  // Wait for the login form to appear
  await page.waitForSelector('h1:has-text("VOID SECTOR")', { timeout: 10000 });
}

// ---- Custom Playwright test fixture ----

type GameFixtures = {
  loginPage: Page;
  gamePage: Page;
};

export const test = base.extend<GameFixtures>({
  loginPage: async ({ page }, use) => {
    await setupLoginScreen(page);
    await use(page);
  },

  gamePage: async ({ page }, use) => {
    await mockWebSocket(page);
    await mockAuth(page);

    // Set localStorage so the app has auth tokens on load
    await page.addInitScript(() => {
      localStorage.setItem('vs_token', 'e2e-test-token');
      localStorage.setItem('vs_playerId', 'e2e-player-001');
      localStorage.setItem('vs_username', 'TestPilot');
      localStorage.setItem('vs-active-program', 'NAV-COM');
    });

    await page.goto('/');
    // The app will read the token from localStorage and attempt to connect.
    // With mocked WebSocket, it stays on login or transitions to game depending
    // on whether the connection callback fires. We'll handle this per-test.
    await use(page);
  },
});

export { expect } from '@playwright/test';
