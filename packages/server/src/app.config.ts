import toolsPkg from '@colyseus/tools';
import { monitor } from '@colyseus/monitor';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import type { Request, Response } from 'express';
import type { Server } from '@colyseus/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SectorRoom } from './rooms/SectorRoom.js';
import { register, login, loginAsGuest, verifyToken, type AuthPayload } from './auth.js';
import { validateFeedbackInput } from './feedbackValidation.js';
import { validateRegisterInput } from './emailValidation.js';
import { createFeedback } from './db/feedbackQueries.js';
import {
  deleteExpiredGuestPlayers,
  findPlayerIdByVerificationToken,
  markEmailVerified,
  recentRegistrationForEmail,
} from './db/queries.js';
import { runMigrations } from './db/client.js';
import { getPlayerPosition } from './rooms/services/RedisAPStore.js';
import { adminRouter } from './adminRoutes.js';
import { logger } from './utils/logger.js';
import { startUniverseEngine } from './engine/universeBootstrap.js';
import { gameConfig } from './engine/gameConfigService.js';

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
        const valid = validateRegisterInput(req.body);
        if (!valid.ok) {
          res.status(400).json({ error: valid.error });
          return;
        }
        // Throttle verification-mail spam to a victim address (shared SMTP server).
        if (await recentRegistrationForEmail(valid.email, 120)) {
          res
            .status(429)
            .json({ error: 'Bitte warte ein paar Minuten, bevor du es erneut versuchst.' });
          return;
        }
        const result = await register(req.body.username, valid.email, req.body.password);
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

    app.get('/api/verify', async (req: Request, res: Response) => {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const page = (title: string, body: string) =>
        `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
        `<style>body{background:#0a0a0a;color:#ffb000;font-family:monospace;display:flex;` +
        `align-items:center;justify-content:center;height:100vh;margin:0}` +
        `.box{border:1px solid #ffb000;padding:24px 32px;max-width:420px;text-align:center}` +
        `a{color:#ffb000}</style></head><body><div class="box">${body}</div></body></html>`;
      try {
        if (!token) {
          res.status(400).send(page('Ungültig', '<h2>VOID SECTOR</h2><p>Ungültiger Bestätigungslink.</p>'));
          return;
        }
        const playerId = await findPlayerIdByVerificationToken(token);
        if (!playerId) {
          res
            .status(404)
            .send(page('Abgelaufen', '<h2>VOID SECTOR</h2><p>Link ungültig oder bereits benutzt.</p>'));
          return;
        }
        await markEmailVerified(playerId);
        const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3201';
        res.send(
          page(
            'Bestätigt',
            '<h2>VOID SECTOR</h2><p>✔ E-Mail bestätigt. Du kannst dich jetzt einloggen.</p>' +
              `<p><a href="${appUrl}">Zum Spiel →</a></p>`,
          ),
        );
      } catch (err) {
        logger.error({ err }, 'Email verify error');
        res.status(500).send(page('Fehler', '<h2>VOID SECTOR</h2><p>Interner Fehler.</p>'));
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
    await gameConfig.init();
    const expiredGuests = await deleteExpiredGuestPlayers();
    if (expiredGuests > 0) {
      logger.info({ expiredGuests }, 'Cleaned up expired guest accounts');
    }
    await startUniverseEngine();
    logger.info('Migrations complete, server starting...');
  },
});
