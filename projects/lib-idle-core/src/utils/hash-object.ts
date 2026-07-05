import type { XXHashAPI } from 'xxhash-wasm';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function hashObject(hasher: XXHashAPI, object: object): string {
  return hasher.h64ToString(JSON.stringify(object));
}
