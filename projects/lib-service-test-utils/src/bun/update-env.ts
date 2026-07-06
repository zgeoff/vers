import { originals } from './original-env';

/**
 * Overrides a single env var for the duration of a test, restored at test cleanup. Mirrors
 * vitest's `vi.stubEnv`. Do NOT use for permanent process env set in a preload — assign
 * `process.env` directly for those.
 */
export function updateEnv(key: string, value: string): void {
  if (!originals.has(key)) {
    originals.set(key, process.env[key]);
  }

  process.env[key] = value;
}
