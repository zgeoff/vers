import { utf8ToBytes } from '@noble/hashes/utils.js';
import invariant from 'tiny-invariant';
import type { RollPosition } from './types';

export function encodePositionBytes(position: RollPosition): Uint8Array {
  assertIdentifier(position.avatarID, 'avatarID');

  if (position.kind === 'craft') {
    assertIndex(position.position, 'craft position');

    return utf8ToBytes(`vers/roll-position/v1|craft|${position.avatarID}|${position.position}`);
  }

  assertIdentifier(position.scopeType, 'scopeType');
  assertIdentifier(position.scopeID, 'scopeID');
  assertIndex(position.chainIndex, 'chainIndex');
  assertIndex(position.ordinal, 'ordinal');

  return utf8ToBytes(
    `vers/roll-position/v1|reward|${position.avatarID}|${position.scopeType}|${position.scopeID}|${position.chainIndex}|${position.ordinal}`,
  );
}

function assertIdentifier(value: string, label: string): void {
  invariant(!value.includes('|'), `${label} must not contain the separator`);

  // utf8 encoding replaces a lone surrogate with U+FFFD, so two distinct malformed ids could
  // encode to the same bytes
  invariant(value.isWellFormed(), `${label} must be well-formed unicode`);
}

function assertIndex(value: number, label: string): void {
  invariant(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}
