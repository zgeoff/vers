import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { buildKeysRouter } from './build-router';
import { KEYS_ENV_SHAPE } from './keys-env-shape';
import { parseRollKeyRoots } from './parse-roll-key-roots';

/**
 * Boots the keys service; the production entrypoint and tests both call this as the one shared config.
 */
export function createKeysService(): Promise<Service<typeof KEYS_ENV_SHAPE>> {
  return createService({
    buildRouter: (runtime) =>
      buildKeysRouter({ roots: parseRollKeyRoots(runtime.env.ROLL_KEY_ROOTS) }),
    envShape: KEYS_ENV_SHAPE,
    name: 'service-keys',
  });
}
