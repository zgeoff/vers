import { originals } from './original-env';

/** Removes every override made since the last restore. Wired into the global preload cleanup. */
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
