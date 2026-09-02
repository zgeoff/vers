import type { EncounterContent } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { deriveWorldmapDescriptor } from './derive-worldmap-descriptor';

export interface DeriveWorldmapContentInput {
  readonly coord: readonly [number, number];
  readonly scopeSecret: Uint8Array;
  readonly userSeed: number;
}

export interface WorldmapContent {
  readonly poolID?: string;
}

export function deriveWorldmapContent(
  content: Readonly<EncounterContent>,
  input: Readonly<DeriveWorldmapContentInput>,
): WorldmapContent {
  if (content.contentVersion === '1') {
    return {};
  }

  const descriptor = deriveWorldmapDescriptor(input);
  const index = pickUniformIndex(descriptor, content.pools.length);
  const pool = content.pools[index];

  invariant(pool, `pool index out of range: ${index}`);

  return { poolID: pool.id };
}

function pickUniformIndex(descriptor: Uint8Array, count: number): number {
  invariant(count > 0, 'count must be positive');

  const view = new DataView(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength);

  return view.getUint32(0, false) % count;
}
