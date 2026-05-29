const CATEGORIES = ['bug', 'idea', 'praise', 'other'] as const;
export type FeedbackCategory = (typeof CATEGORIES)[number];

export interface ValidFeedback {
  category: FeedbackCategory;
  message: string;
}
export interface FeedbackError {
  error: string;
}

/** Pure validation for incoming feedback. Returns the normalized payload or an error. */
export function validateFeedbackInput(body: unknown): ValidFeedback | FeedbackError {
  const b = (body ?? {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (message.length === 0) return { error: 'message required' };
  if (message.length > 2000) return { error: 'message too long (max 2000)' };
  const raw = typeof b.category === 'string' ? b.category : 'other';
  const category = (CATEGORIES as readonly string[]).includes(raw)
    ? (raw as FeedbackCategory)
    : 'other';
  return { category, message };
}
