const originals = new Map<string, string | undefined>();

/**
 * Per-test env override, restored by `unstubAllEnvs`. Mirrors vitest's `vi.stubEnv`. Do NOT use
 * for permanent process env set in a preload — assign `process.env` directly for those.
 */
export function stubEnv(key: string, value: string): void {
  if (!originals.has(key)) {
    originals.set(key, process.env[key]);
  }

  process.env[key] = value;
}

/** Restores every `stubEnv` override made since the last restore. Wired into the global preload cleanup. */
export function unstubAllEnvs(): void {
  for (const [key, value] of originals) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  originals.clear();
}
