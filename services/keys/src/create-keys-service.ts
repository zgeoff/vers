import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import * as z from 'zod';
import { buildKeysRouter } from './build-router';
import { parseRollKeyRoots } from './parse-roll-key-roots';

/**
 * Boots the keys service; the production entrypoint and tests both call this as the one shared config.
 */
export function createKeysService(): Promise<Service<{ ROLL_KEY_ROOTS: z.ZodString }>> {
  return createService({
    buildRouter: (runtime) =>
      buildKeysRouter({ roots: parseRollKeyRoots(runtime.env.ROLL_KEY_ROOTS) }),
    envShape: { ROLL_KEY_ROOTS: z.string().min(1) },
    name: 'service-keys',
  });
}
