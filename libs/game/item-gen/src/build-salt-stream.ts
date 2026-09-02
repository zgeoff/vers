import { buildRollStream } from '@vers/roll-crypto';
import type { RollStream } from '@vers/roll-crypto';
import invariant from 'tiny-invariant';

const SALT_STREAM_DOMAIN = 'vers/roll-stream/salt/v1';

export function buildSaltStream(salt: Uint8Array): RollStream {
  invariant(salt.length > 0, 'salt must not be empty');

  return buildRollStream(salt, SALT_STREAM_DOMAIN);
}
