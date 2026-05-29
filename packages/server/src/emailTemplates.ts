/** HTML-escape for interpolating user-controlled text into email HTML. */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Branded verification email (dark terminal/space theme), email-client-safe (tables + inline styles). */
export function renderVerificationEmail(username: string, verifyLink: string): RenderedEmail {
  const u = escapeHtml(username);
  const subject = 'VOID SECTOR — E-Mail bestätigen';
  const text =
    `Willkommen an Bord, ${username}!\n\n` +
    `Aktiviere deinen Pilotenzugang — bestätige deine E-Mail-Adresse:\n${verifyLink}\n\n` +
    `Wenn du dich nicht registriert hast, ignoriere diese Nachricht.\n\n— VOID SECTOR`;
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#05060a;color:#cdd3dc;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05060a;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#0d1018;border:1px solid #1d2433;border-radius:10px;overflow:hidden">
        <tr><td style="background:#11151f;padding:24px 28px;border-bottom:1px solid #1d2433">
          <div style="font-size:20px;letter-spacing:4px;color:#ffb000;font-weight:bold">◈ VOID SECTOR</div>
          <div style="font-size:12px;letter-spacing:2px;color:#5b6478;margin-top:4px">PILOT-REGISTRIERUNG</div>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 14px;font-size:15px;color:#e6eaf0">Willkommen an Bord, <strong style="color:#ffb000">${u}</strong>!</p>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#aab2c0">Aktiviere deinen Zugang zum Sektor — bestätige deine E-Mail-Adresse mit einem Klick:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px"><tr><td style="border-radius:6px;background:#ffb000">
            <a href="${verifyLink}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:bold;letter-spacing:1px;color:#0a0d14;text-decoration:none">E-MAIL BESTÄTIGEN &rarr;</a>
          </td></tr></table>
          <p style="margin:0 0 6px;font-size:11px;color:#5b6478">Falls der Button nicht funktioniert, kopiere diesen Link:</p>
          <p style="margin:0 0 20px;font-size:11px;word-break:break-all"><a href="${verifyLink}" style="color:#5aa9e6">${verifyLink}</a></p>
          <p style="margin:0;font-size:11px;color:#4a5160;border-top:1px solid #1d2433;padding-top:16px">Wenn du dich nicht registriert hast, ignoriere diese Nachricht einfach.</p>
        </td></tr>
        <tr><td style="background:#0a0d14;padding:14px 28px;border-top:1px solid #1d2433;font-size:10px;letter-spacing:1px;color:#3a4150">VOID SECTOR · voidsector.mr-development.de</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}
