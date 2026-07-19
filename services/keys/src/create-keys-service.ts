import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import * as z from 'zod';
import { buildKeysRouter } from './build-router';
import { parseRollKeyRoots } from './parse-roll-key-roots';

const envShape = {
  ROLL_KEY_ROOTS: z
    .string()
    .min(1)
    .describe(
      'JSON payload of per-population roll-key roots: each population carries its current key version and every root version still derived against',
    ),
};

/**
 * Boots the keys service; the production entrypoint and tests both call this as the one shared config.
 */
export function createKeysService(): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: (runtime) =>
      buildKeysRouter({ roots: parseRollKeyRoots(runtime.env.ROLL_KEY_ROOTS) }),
    envShape,
    name: 'service-keys',
  });
}
