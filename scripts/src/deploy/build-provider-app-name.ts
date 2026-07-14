/**
 * The per-version provider app's name — deterministic from the engine hash,
 * so a fresh deploy and a later reconcile always agree on which app to
 * check for.
 */
export function buildProviderAppName(engineHash: string): string {
  return `vers-replay-${engineHash.slice(0, 12)}`;
}
