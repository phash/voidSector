import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from './utils/logger.js';
import { renderVerificationEmail } from './emailTemplates.js';

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
  const mail = renderVerificationEmail(username, link);
  await t.sendMail({ from: FROM, to, subject: mail.subject, text: mail.text, html: mail.html });
  logger.info({ to }, 'Verification email sent');
}
