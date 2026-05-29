import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from './utils/logger.js';

const FROM = process.env.EMAIL_FROM || 'noreply@mr-development.de';
const HOST = process.env.EMAIL_SMTP_HOST || 'mail.mr-development.de';
const PORT = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
const USER = process.env.EMAIL_SMTP_USER || 'noreply@mr-development.de';
const PASS = process.env.EMAIL_SMTP_PASS || '';
const APP_URL = process.env.APP_PUBLIC_URL || 'http://localhost:3201';

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!PASS) return null; // email disabled (dev/test) when no credentials configured
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

/** True when SMTP credentials are configured (i.e. mail will actually be sent). */
export function isEmailEnabled(): boolean {
  return !!PASS;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

/**
 * Sends the verification email. Best-effort: if SMTP is not configured the call is a no-op
 * (logged), so registration still succeeds in dev/test.
 */
export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string,
): Promise<void> {
  const t = getTransport();
  const link = `${APP_URL}/api/verify?token=${encodeURIComponent(token)}`;
  if (!t) {
    logger.warn({ to }, 'Email disabled (no EMAIL_SMTP_PASS) — skipping verification mail');
    return;
  }
  await t.sendMail({
    from: FROM,
    to,
    subject: 'VOID SECTOR — E-Mail bestätigen',
    text:
      `Willkommen an Bord, ${username}!\n\n` +
      `Bitte bestätige deine E-Mail-Adresse über diesen Link:\n${link}\n\n` +
      `Wenn du dich nicht registriert hast, ignoriere diese Nachricht.`,
    html:
      `<p>Willkommen an Bord, <strong>${escapeHtml(username)}</strong>!</p>` +
      `<p>Bitte bestätige deine E-Mail-Adresse:</p>` +
      `<p><a href="${link}">${link}</a></p>` +
      `<p style="color:#888">Wenn du dich nicht registriert hast, ignoriere diese Nachricht.</p>`,
  });
  logger.info({ to }, 'Verification email sent');
}
