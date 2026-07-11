import type { FlagKey } from './types';

/**
 * Derives a flag's env var name mechanically from its registry key: `FEATURE_` prefix plus the
 * kebab-case key upper-cased and dash-joined (`'market'` → `'FEATURE_MARKET'`).
 */
export function toFlagEnvVar(key: FlagKey): string {
  return `FEATURE_${key.toUpperCase().replaceAll('-', '_')}`;
}
