import { createHash } from 'node:crypto';

/**
 * Session advisory locks take a signed 64-bit key; the template name's
 * sha256 hash gives every distinct name its own lock without a central
 * registry. Returned as a decimal string and cast to `bigint` in SQL, since
 * the postgres client's parameter types don't accept a JS `bigint` directly.
 */
export function buildAdvisoryLockKey(name: string): string {
  return createHash('sha256').update(name).digest().readBigInt64BE(0).toString();
}
