import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createPlayer, createGuestPlayer, findPlayerByUsername } from './db/queries.js';
import type { PlayerData } from '@void-sector/shared';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SALT_ROUNDS = 10;

export interface AuthPayload {
  userId: string;
  username: string;
  isGuest?: boolean;
}

export async function register(
  username: string,
  password: string,
): Promise<{ player: PlayerData; token: string }> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const player = await createPlayer(username, passwordHash);
  const token = jwt.sign(
    { userId: player.id, username: player.username } satisfies AuthPayload,
    JWT_SECRET,
    { expiresIn: '7d' },
  );
  return { player, token };
}

export async function login(
  username: string,
  password: string,
): Promise<{ player: PlayerData; token: string } | null> {
  const found = await findPlayerByUsername(username);
  if (!found) return null;

  const valid = await bcrypt.compare(password, found.passwordHash);
  if (!valid) return null;

  const { passwordHash: _, ...player } = found;
  const token = jwt.sign(
    { userId: player.id, username: player.username } satisfies AuthPayload,
    JWT_SECRET,
    { expiresIn: '7d' },
  );
  return { player, token };
}

export async function loginAsGuest(): Promise<{ player: PlayerData; token: string }> {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const username = `GAST-${hex}`;
  const player = await createGuestPlayer(username);
  const token = jwt.sign(
    { userId: player.id, username: player.username, isGuest: true } satisfies AuthPayload,
    JWT_SECRET,
    { expiresIn: '24h' },
  );
  return { player, token };
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
