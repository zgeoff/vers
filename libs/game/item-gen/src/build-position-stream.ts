import { hexToBytes } from '@noble/hashes/utils.js';
import { buildRollDigest } from '@vers/roll-crypto';
import { buildRollStream } from './build-roll-stream';
import { encodePositionBytes } from './encode-position-bytes';
import type { RollPosition, RollStream } from './types';

const POSITION_STREAM_DOMAIN = 'vers/roll-stream/position/v1';

/**
 * Builds the keyed position stream: the keyed digest over the position's canonical bytes under the
 * avatar's roll key, expanded under a frozen domain label. Only a key holder can compute it, and
 * rebuilding from equal inputs reproduces the identical draw sequence.
 */
export function buildPositionStream(avatarKey: Uint8Array, position: RollPosition): RollStream {
  const digest = buildRollDigest(avatarKey, encodePositionBytes(position));

  return buildRollStream(hexToBytes(digest), POSITION_STREAM_DOMAIN);
}
