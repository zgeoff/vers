const HONEYPOT_MIN_FILL_TIME_MS = 1500;

export function buildHoneypotValidFrom(): string {
  return String(Date.now() + HONEYPOT_MIN_FILL_TIME_MS);
}
