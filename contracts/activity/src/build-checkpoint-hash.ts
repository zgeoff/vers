import { createHash } from 'node:crypto';

interface BuildCheckpointHashInput {
  readonly nextSeed: string;
  readonly prevHash: string;
  readonly seed: string;
  readonly time: number;
  readonly type: string;
  readonly version: number;
}

/**
 * The checkpoint hash chain's link function: a sha256 hex digest over the canonical field order
 * `[prevHash, version, seed, nextSeed, time, type]`. Shared by the contract, the service, and (via
 * this package) the client, so every party derives the same hash from the same fields.
 */
export function buildCheckpointHash(input: Readonly<BuildCheckpointHashInput>): string {
  const canonical = JSON.stringify([
    input.prevHash,
    input.version,
    input.seed,
    input.nextSeed,
    input.time,
    input.type,
  ]);

  return createHash('sha256').update(canonical).digest('hex');
}
