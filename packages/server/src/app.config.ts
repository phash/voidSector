import toolsPkg from '@colyseus/tools';
import { monitor } from '@colyseus/monitor';
import express from 'express';
import { SectorRoom } from './rooms/SectorRoom.js';
import { register, login } from './auth.js';
import { runMigrations } from './db/client.js';
import { getPlayerPosition } from './rooms/services/RedisAPStore.js';

// @colyseus/tools CJS interop: default.default holds the config function
const config = (toolsPkg as any).default ?? toolsPkg;

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('sector', SectorRoom);
  },

  initializeExpress: (app) => {
    app.use(express.json());

    app.post('/api/register', async (req, res) => {
      try {
        const { username, password } = req.body;
        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
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
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/login', async (req, res) => {
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
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/healthz', (_req, res) => {
      res.json({ ok: true });
    });

    app.use('/colyseus', monitor());
  },

  beforeListen: async () => {
    await runMigrations();
    console.log('Migrations complete, server starting...');
  },
});
