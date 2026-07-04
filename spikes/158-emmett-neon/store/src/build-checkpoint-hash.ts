import { createHash } from 'node:crypto';

/**
 * Next link of an activity's hash chain: sha256 over the previous link and the
 * canonical JSON of the payload being recorded.
 */
export function buildCheckpointHash(prevHash: string, payload: unknown): string {
  return createHash('sha256').update(prevHash).update(toCanonicalJSON(payload)).digest('hex');
}

/** JSON with object keys sorted recursively, so hashes don't depend on key order. */
function toCanonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, child]) => [key, sortKeys(child)]),
    );
  }
  return value;
}
