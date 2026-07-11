import type { XXHashAPI } from 'xxhash-wasm';

export function hashObject(hasher: XXHashAPI, object: object): string {
  return hasher.h64ToString(JSON.stringify(object));
}
