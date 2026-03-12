import toolsPkg from '@colyseus/tools';
import { monitor } from '@colyseus/monitor';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import type { Request, Response } from 'express';
import type { Server } from '@colyseus/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SectorRoom } from './rooms/SectorRoom.js';
import { register, login, loginAsGuest } from './auth.js';
import { deleteExpiredGuestPlayers } from './db/queries.js';
import { runMigrations } from './db/client.js';
import { getPlayerPosition } from './rooms/services/RedisAPStore.js';
import { adminRouter } from './adminRoutes.js';
import { logger } from './utils/logger.js';
import { startUniverseEngine } from './engine/universeBootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// @colyseus/tools CJS interop: default.default holds the config function
const config = (toolsPkg as any).default ?? toolsPkg;

export default config({
  initializeTransport: (options: any) =>
    new WebSocketTransport({
      ...options,
      pingInterval: 10000, // 10s (default: 3s) — more tolerant for cloudflare tunnels
      pingMaxRetries: 3, // 3 retries (default: 2)
    }),

  initializeGameServer: (gameServer: Server) => {
    gameServer.define('sector', SectorRoom).filterBy(['quadrantX', 'quadrantY']);
  },

  initializeExpress: (app: express.Express) => {
    app.use(express.json());

    app.post('/api/register', async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (
          !username ||
          !password ||
          typeof username !== 'string' ||
          typeof password !== 'string'
        ) {
          res.status(400).json({ error: 'Username and password required' });
          return;
        }
        if (username.length < 3 || username.length > 32) {
          res.status(400).json({ error: 'Username must be 3-32 characters' });
          return;
        }
        if (password.length < 6) {
          res.status(400).json({ error: 'Password must be at least 6 characters' });
          return;
        }
        const result = await register(username, password);
        res.json({ token: result.token, player: result.player });
      } catch (err: any) {
        if (err.code === '23505') {
          // PostgreSQL unique_violation
          res.status(409).json({ error: 'Username already taken' });
          return;
        }
        logger.error({ err }, 'Registration error');
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/login', async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        const result = await login(username, password);
        if (!result) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
        // Include last known position so client can rejoin correct sector
        const lastPos = await getPlayerPosition(result.player.id);
        res.json({
          token: result.token,
          player: result.player,
          lastPosition: lastPos ?? { x: 0, y: 0 },
        });
      } catch (err) {
        logger.error({ err }, 'Login error');
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/guest', async (_req: Request, res: Response) => {
      try {
        const result = await loginAsGuest();
        res.json({
          token: result.token,
          player: result.player,
          lastPosition: { x: 0, y: 0 },
        });
      } catch (err) {
        logger.error({ err }, 'Guest login error');
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/healthz', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    app.get('/admin', (_req: Request, res: Response) => {
      res.sendFile(join(__dirname, 'admin', 'console.html'));
    });
    app.use('/admin/api', adminRouter);
    app.use('/colyseus', monitor());
  },

  beforeListen: async () => {
    await runMigrations();
    const expiredGuests = await deleteExpiredGuestPlayers();
    if (expiredGuests > 0) {
      logger.info({ expiredGuests }, 'Cleaned up expired guest accounts');
    }
    await startUniverseEngine();
    logger.info('Migrations complete, server starting...');
  },
});
