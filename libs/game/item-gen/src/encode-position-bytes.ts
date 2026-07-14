import { utf8ToBytes } from '@noble/hashes/utils.js';
import invariant from 'tiny-invariant';
import type { RollPosition } from './types';

/**
 * Canonical byte encoding of a roll position, pipe-joined utf8 with the kind token ahead of every
 * caller field, so the two kinds can never collide. The layout is frozen; its `v1` segment is
 * scheme versioning. Field values must not contain the `|` separator — identifiers are opaque ids
 * and a separator inside one means a bug upstream.
 */
export function encodePositionBytes(position: RollPosition): Uint8Array {
  invariant(!position.avatarID.includes('|'), 'avatarID must not contain the separator');

  if (position.kind === 'craft') {
    assertIndex(position.position, 'craft position');

    return utf8ToBytes(`vers/roll-position/v1|craft|${position.avatarID}|${position.position}`);
  }

  invariant(!position.nodeID.includes('|'), 'nodeID must not contain the separator');
  assertIndex(position.chainIndex, 'chainIndex');
  assertIndex(position.ordinal, 'ordinal');

  return utf8ToBytes(
    `vers/roll-position/v1|reward|${position.avatarID}|${position.nodeID}|${position.chainIndex}|${position.ordinal}`,
  );
}

function assertIndex(value: number, label: string): void {
  invariant(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}
