import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { insertOriginNotice, getOriginNotices } from '../../db/queries.js';

export const NOTICE_MAX_LEN = 280;

export function validateNoticeMessage(
  raw: string,
): { ok: true; message: string } | { ok: false; reason: string } {
  const message = (raw ?? '').trim();
  if (message.length === 0) return { ok: false, reason: 'EMPTY' };
  if (message.length > NOTICE_MAX_LEN) return { ok: false, reason: 'TOO_LONG' };
  return { ok: true, message };
}

export class NoticeService {
  constructor(private ctx: ServiceContext) {}

  async handlePost(client: Client, raw: string, px: number, py: number): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'originNotice', 30_000)) {
      this.ctx.send(client, 'error', {
        code: 'RATE_LIMIT',
        message: 'Bitte warte kurz, bevor du erneut postest.',
      });
      return;
    }
    if (px !== 0 || py !== 0) {
      this.ctx.send(client, 'error', {
        code: 'NOT_AT_ORIGIN',
        message: 'Nur am Zentrum (Sektor 0:0) kannst du posten.',
      });
      return;
    }
    const v = validateNoticeMessage(raw);
    if (!v.ok) {
      this.ctx.send(client, 'error', {
        code: 'INVALID_NOTICE',
        message: v.reason === 'TOO_LONG' ? `Max ${NOTICE_MAX_LEN} Zeichen.` : 'Leere Nachricht.',
      });
      return;
    }
    const auth = client.auth as AuthPayload;
    const notice = await insertOriginNotice(auth.userId, auth.username, v.message);
    if (notice) this.ctx.send(client, 'originNoticePosted', { notice });
  }

  async handleGet(client: Client): Promise<void> {
    const notices = await getOriginNotices(50);
    this.ctx.send(client, 'originNoticesResult', { notices });
  }
}
