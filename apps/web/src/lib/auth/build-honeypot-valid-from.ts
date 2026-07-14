/**
 * A human takes at least this long to fill in a form; a faster submission is treated as a bot.
 */
const HONEYPOT_MIN_FILL_TIME_MS = 1500;

/**
 * Computes the valid-from timestamp for a freshly rendered form.
 *
 * Client hydration recomputes the rendered value, so the override must reach the browser bundle:
 * `VITE_HONEYPOT_MIN_FILL_TIME_MS` lifts the human-speed floor so e2e runs can submit forms
 * instantly. Production builds never set it.
 */
export function buildHoneypotValidFrom(): string {
  const envOverride: string | undefined = import.meta.env['VITE_HONEYPOT_MIN_FILL_TIME_MS'];
  const overrideMs = Number(envOverride);
  const minFillTimeMs = Number.isFinite(overrideMs) ? overrideMs : HONEYPOT_MIN_FILL_TIME_MS;

  return String(Date.now() + minFillTimeMs);
}
