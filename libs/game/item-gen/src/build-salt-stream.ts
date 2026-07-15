import invariant from 'tiny-invariant';
import { buildRollStream } from './build-roll-stream';
import type { RollStream } from './types';

const SALT_STREAM_DOMAIN = 'vers/roll-stream/salt/v1';

/**
 * Builds a roll stream from a sealed pre-commit salt. The domain label is distinct from the keyed
 * position stream's, so a salt and a position digest holding equal bytes still produce disjoint
 * draws.
 */
export function buildSaltStream(salt: Uint8Array): RollStream {
  invariant(salt.length > 0, 'salt must not be empty');

  return buildRollStream(salt, SALT_STREAM_DOMAIN);
}
