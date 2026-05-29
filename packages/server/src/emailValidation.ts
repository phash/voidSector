/** Pragmatic email format check (not full RFC 5322, but rejects obvious garbage). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type RegisterValidation = { ok: true; email: string } | { ok: false; error: string };

/** Validates registration input (username 3-32, password >=6, valid email). Trims the email. */
export function validateRegisterInput(b: {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}): RegisterValidation {
  const username = typeof b.username === 'string' ? b.username : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (username.length < 3 || username.length > 32) {
    return { ok: false, error: 'Username must be 3-32 characters' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Valid email required' };
  }
  return { ok: true, email };
}
