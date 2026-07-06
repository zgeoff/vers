const originals = new Map<string, string | undefined>();

/**
 * Overrides a single env var for the duration of a test, restored by `removeEnvOverrides`. Mirrors
 * vitest's `vi.stubEnv`. Do NOT use for permanent process env set in a preload — assign
 * `process.env` directly for those.
 */
export function updateEnv(key: string, value: string): void {
  if (!originals.has(key)) {
    originals.set(key, process.env[key]);
  }

  process.env[key] = value;
}

/** Removes every `updateEnv` override made since the last restore. Wired into the global preload cleanup. */
export function removeEnvOverrides(): void {
  for (const [key, value] of originals) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  originals.clear();
}
