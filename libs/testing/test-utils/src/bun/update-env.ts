import { originals } from './original-env';

export function updateEnv(key: string, value: string | undefined): void {
  if (!originals.has(key)) {
    originals.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
