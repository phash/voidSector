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
import { sendVerificationEmail } from './emailService.js';
import { createFeedback } from './db/feedbackQueries.js';
import {
  deleteExpiredGuestPlayers,
  getVerificationByToken,
  markEmailVerified,
  recentRegistrationForEmail,
  getPlayerVerificationInfo,
  setVerificationToken,
} from './db/queries.js';
import crypto from 'crypto';
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
      const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3201';
      const page = (title: string, heading: string, body: string, accent = '#ffb000') =>
        `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · VOID SECTOR</title>` +
        `<style>*{box-sizing:border-box}body{background:#05060a;color:#cdd3dc;` +
        `font-family:'Segoe UI',Arial,Helvetica,sans-serif;display:flex;align-items:center;` +
        `justify-content:center;min-height:100vh;margin:0;padding:16px}` +
        `.box{background:#0d1018;border:1px solid #1d2433;border-radius:10px;max-width:420px;width:100%;padding:32px;text-align:center}` +
        `.brand{font-size:13px;letter-spacing:4px;color:${accent};font-weight:bold;margin-bottom:18px}` +
        `h2{font-size:18px;margin:0 0 10px;color:#e6eaf0}p{font-size:14px;line-height:1.6;color:#aab2c0;margin:0 0 20px}` +
        `.btn{display:inline-block;background:${accent};color:#0a0d14;text-decoration:none;font-weight:bold;` +
        `letter-spacing:1px;padding:11px 26px;border-radius:6px;font-size:13px}</style></head>` +
        `<body><div class="box"><div class="brand">◈ VOID SECTOR</div><h2>${heading}</h2><p>${body}</p>` +
        `<a class="btn" href="${appUrl}">ZUM SPIEL &rarr;</a></div></body></html>`;
      try {
        if (!token) {
          res
            .status(400)
            .send(page('Ungültig', 'Ungültiger Link', 'Dieser Bestätigungslink ist unvollständig.', '#ff6b6b'));
          return;
        }
        const info = await getVerificationByToken(token);
        if (!info) {
          res
            .status(404)
            .send(
              page(
                'Abgelaufen',
                'Link nicht gültig',
                'Dieser Bestätigungslink ist ungültig oder abgelaufen. Falls deine E-Mail bereits bestätigt ist, logge dich einfach ein.',
                '#ff6b6b',
              ),
            );
          return;
        }
        if (info.emailVerified) {
          res.send(
            page(
              'Bereits bestätigt',
              'Bereits bestätigt ✓',
              'Diese E-Mail-Adresse ist bereits bestätigt. Du kannst dich direkt einloggen.',
            ),
          );
          return;
        }
        await markEmailVerified(info.id);
        res.send(
          page('Bestätigt', 'E-Mail bestätigt ✓', 'Willkommen an Bord, Pilot! Dein Zugang ist jetzt aktiv.'),
        );
      } catch (err) {
        logger.error({ err }, 'Email verify error');
        res
          .status(500)
          .send(page('Fehler', 'Interner Fehler', 'Bitte versuche es später erneut.', '#ff6b6b'));
      }
    });

    app.post('/api/resend-verification', async (req: Request, res: Response) => {
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
          res.status(403).json({ error: 'Guests have no email' });
          return;
        }
        const info = await getPlayerVerificationInfo(auth.userId);
        if (!info || !info.email) {
          res.status(400).json({ error: 'Kein E-Mail-Konto für diesen Account.' });
          return;
        }
        if (info.emailVerified) {
          res.json({ status: 'already_verified' });
          return;
        }
        if (await recentRegistrationForEmail(info.email, 120)) {
          res
            .status(429)
            .json({ error: 'Bitte warte ein paar Minuten, bevor du es erneut versuchst.' });
          return;
        }
        const token = crypto.randomBytes(32).toString('hex');
        await setVerificationToken(auth.userId, token);
        sendVerificationEmail(info.email, auth.username, token).catch((err) =>
          logger.error({ err }, 'resend verification email failed'),
        );
        res.json({ status: 'sent' });
      } catch (err) {
        logger.error({ err }, 'Resend verification error');
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
