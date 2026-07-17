/**
 * A human takes at least this long to fill in a form; a faster submission is treated as a bot.
 */
const HONEYPOT_MIN_FILL_TIME_MS = 1500;

/**
 * Computes the valid-from timestamp for a freshly rendered form. The floor has no env override:
 * e2e specs pace their submits past the window instead, so the artifact under test enforces the
 * same timing it ships with.
 */
export function buildHoneypotValidFrom(): string {
  return String(Date.now() + HONEYPOT_MIN_FILL_TIME_MS);
}
