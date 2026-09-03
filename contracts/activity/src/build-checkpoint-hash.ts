import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

interface BuildCheckpointHashInput {
  readonly chainIndex: number;
  readonly entropySource: string;
  readonly nextSeed: string;
  readonly prevHash: string;
  readonly seed: string;
  readonly time: number;
  readonly type: string;
  readonly version: number;
}

export function buildCheckpointHash(input: Readonly<BuildCheckpointHashInput>): string {
  const canonical = JSON.stringify([
    input.prevHash,
    input.version,
    input.chainIndex,
    input.seed,
    input.nextSeed,
    input.time,
    input.type,
    input.entropySource,
  ]);

  return bytesToHex(sha256(utf8ToBytes(canonical)));
}
