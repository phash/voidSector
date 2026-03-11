import { createHash } from 'crypto';
import { upsertErrorLog } from '../db/adminQueries.js';

function extractLocation(stack: string | undefined): string | null {
  if (!stack) return null;
  for (const line of stack.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('at ') && !trimmed.includes('node_modules')) {
      return trimmed.replace(/^at /, '');
    }
  }
  return null;
}

export async function captureError(err: Error, _context: string): Promise<void> {
  try {
    const location = extractLocation(err.stack);
    const fingerprint = createHash('sha256')
      .update((err.message ?? '') + (location ?? ''))
      .digest('hex');
    await upsertErrorLog(fingerprint, err.message ?? 'Unknown error', location, err.stack ?? null);
  } catch {
    // Never propagate — fire-and-forget
  }
}
