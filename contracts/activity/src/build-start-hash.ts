import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

interface BuildStartHashInput {
  readonly activityID: string;
  readonly contentVersion: string;
  readonly keyVersion: number;
  readonly seed: string;
  readonly simVersion: string;
}

/**
 * The checkpoint hash chain's root: a sha256 hex digest over the canonical field order
 * `[activityID, seed, simVersion, contentVersion, keyVersion]`, seeding `last_hash` before the
 * first checkpoint links onto it.
 */
export function buildStartHash(input: Readonly<BuildStartHashInput>): string {
  const canonical = JSON.stringify([
    input.activityID,
    input.seed,
    input.simVersion,
    input.contentVersion,
    input.keyVersion,
  ]);

  return bytesToHex(sha256(utf8ToBytes(canonical)));
}
