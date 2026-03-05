import type { Client } from 'colyseus';
import type { AuthPayload } from '../../auth.js';

export function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

export function isPositiveInt(v: unknown): v is number {
  return isInt(v) && v > 0;
}

export function isGuest(client: Client): boolean {
  return (client.auth as AuthPayload)?.isGuest === true;
}

export function rejectGuest(client: Client, action: string): boolean {
  if (!isGuest(client)) return false;
  client.send('error', { code: 'GUEST_RESTRICTED', message: `${action} ist für Gäste nicht verfügbar` });
  return true;
}

export const MAX_COORD = 100_000_000;
