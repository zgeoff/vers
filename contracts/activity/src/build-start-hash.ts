import { createHash } from 'node:crypto';

interface BuildStartHashInput {
  readonly activityID: string;
  readonly contentVersion: string;
  readonly seed: string;
  readonly simVersion: string;
}

/**
 * The checkpoint hash chain's root: a sha256 hex digest over the canonical field order
 * `[activityID, seed, simVersion, contentVersion]`, seeding `last_hash` before the first
 * checkpoint links onto it.
 */
export function buildStartHash(input: Readonly<BuildStartHashInput>): string {
  const canonical = JSON.stringify([
    input.activityID,
    input.seed,
    input.simVersion,
    input.contentVersion,
  ]);

  return createHash('sha256').update(canonical).digest('hex');
}
