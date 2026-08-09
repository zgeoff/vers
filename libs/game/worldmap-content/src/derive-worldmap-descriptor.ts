import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import invariant from 'tiny-invariant';

export interface DeriveWorldmapDescriptorInput {
  readonly coord: readonly [number, number];
  readonly scopeSecret: Uint8Array;
  readonly userSeed: number;
}

/**
 * Derives a world map node's sealed descriptor: HMAC-SHA256 keyed by the scope secret over the
 * canonical `vers/worldmap-descriptor/v1|cx|cy|userSeed` byte encoding. Pure: identical input
 * always yields an identical descriptor, and it is uncorrelated with public node geometry — no
 * client can reproduce it without the scope secret.
 *
 * The `v1` segment is scheme versioning, frozen alongside the byte layout. The coordinate and user
 * seed are decimal-formatted before joining, so distinct integers can never collide through digit
 * concatenation.
 */
export function deriveWorldmapDescriptor(
  input: Readonly<DeriveWorldmapDescriptorInput>,
): Uint8Array {
  const [cx, cy] = input.coord;

  assertSafeInteger(cx, 'cx');
  assertSafeInteger(cy, 'cy');
  assertSafeInteger(input.userSeed, 'userSeed');

  const info = utf8ToBytes(`vers/worldmap-descriptor/v1|${cx}|${cy}|${input.userSeed}`);

  return hmac(sha256, input.scopeSecret, info);
}

function assertSafeInteger(value: number, label: string): void {
  invariant(Number.isSafeInteger(value), `${label} must be a safe integer`);
}
