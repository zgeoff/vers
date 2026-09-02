import { createHash } from 'node:crypto';

// returned as a decimal string and cast to bigint in SQL: the postgres client's parameter types
// do not accept a JS bigint directly
export function buildAdvisoryLockKey(name: string): string {
  return createHash('sha256').update(name).digest().readBigInt64BE(0).toString();
}
