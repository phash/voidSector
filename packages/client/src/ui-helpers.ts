/** Wraps a string in CRT bracket notation: ACCEPT → [ACCEPT] */
export function btn(label: string): string {
  return `[${label}]`;
}

/** Wraps a disabled button label with its blocking reason: JUMP → [JUMP — NO AP] */
export function btnDisabled(label: string, reason: string): string {
  return `[${label} — ${reason}]`;
}
