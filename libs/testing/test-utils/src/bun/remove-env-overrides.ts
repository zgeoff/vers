import { originals } from './original-env';

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
