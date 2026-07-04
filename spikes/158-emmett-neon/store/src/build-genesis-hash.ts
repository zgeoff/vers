import { createHash } from 'node:crypto';

/** First link of an activity's hash chain, derived from its identity and seed. */
export function buildGenesisHash(activityId: string, seed: string): string {
  return createHash('sha256').update(`${activityId}:${seed}`).digest('hex');
}
