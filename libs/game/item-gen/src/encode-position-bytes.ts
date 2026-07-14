import { utf8ToBytes } from '@noble/hashes/utils.js';
import invariant from 'tiny-invariant';
import type { RollPosition } from './types';

/**
 * Canonical byte encoding of a roll position, pipe-joined utf8 with the kind token ahead of every
 * caller field, so the two kinds can never collide. The layout is frozen; its `v1` segment is
 * scheme versioning. Identifiers are opaque ids: one containing the `|` separator or malformed
 * unicode (whose lossy utf8 replacement could collide two distinct ids) means a bug upstream.
 */
export function encodePositionBytes(position: RollPosition): Uint8Array {
  assertIdentifier(position.avatarID, 'avatarID');

  if (position.kind === 'craft') {
    assertIndex(position.position, 'craft position');

    return utf8ToBytes(`vers/roll-position/v1|craft|${position.avatarID}|${position.position}`);
  }

  assertIdentifier(position.nodeID, 'nodeID');
  assertIndex(position.chainIndex, 'chainIndex');
  assertIndex(position.ordinal, 'ordinal');

  return utf8ToBytes(
    `vers/roll-position/v1|reward|${position.avatarID}|${position.nodeID}|${position.chainIndex}|${position.ordinal}`,
  );
}

function assertIdentifier(value: string, label: string): void {
  invariant(!value.includes('|'), `${label} must not contain the separator`);
  invariant(value.isWellFormed(), `${label} must be well-formed unicode`);
}

function assertIndex(value: number, label: string): void {
  invariant(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}
