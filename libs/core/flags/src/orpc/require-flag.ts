import { ORPCError, os } from '@orpc/server';
import { FLAGS } from '../flags';
import { getFlagClient } from '../get-flag-client';
import type { FlagKey } from '../types';

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
