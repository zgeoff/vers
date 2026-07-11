/**
 * A human takes at least this long to fill in a form; a faster submission is treated as a bot.
 */
const HONEYPOT_MIN_FILL_TIME_MS = 1500;

/**
 * Computes the valid-from timestamp for a freshly rendered form.
 */
export function buildHoneypotValidFrom(): string {
  return String(Date.now() + HONEYPOT_MIN_FILL_TIME_MS);
}
