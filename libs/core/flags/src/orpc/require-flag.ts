import { ORPCError, os } from '@orpc/server';
import { FLAGS } from '../flags';
import { getFlagClient } from '../get-flag-client';
import type { FlagKey } from '../types';

/**
 * oRPC middleware gating a procedure behind a registered flag: evaluates it server-side and
 * throws `NOT_FOUND` when the flag is off, so a disabled feature's endpoints look absent rather
 * than forbidden. Usable on any `implement()`-based router via
 * `os.someProcedure.use(requireFlag('market'))`.
 */
export function requireFlag(key: FlagKey) {
  return os.middleware(async (options) => {
    const client = getFlagClient();

    const isEnabled = await client.getBooleanValue(key, FLAGS[key].defaultValue);

    if (!isEnabled) {
      throw new ORPCError('NOT_FOUND');
    }

    return options.next();
  });
}
