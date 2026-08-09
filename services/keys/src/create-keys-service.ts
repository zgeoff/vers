import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { buildKeysRouter } from './build-router';
import { envShape } from './env-shape';
import { parseRollKeyRoots } from './parse-roll-key-roots';
import { parseScopeSecretRoots } from './parse-scope-secret-roots';

/**
 * Boots the keys service; the production entrypoint and tests both call this as the one shared config.
 */
export function createKeysService(): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: (runtime) =>
      buildKeysRouter({
        roots: parseRollKeyRoots(runtime.env.ROLL_KEY_ROOTS),
        scopeRoots: parseScopeSecretRoots(runtime.env.SCOPE_SECRET_ROOTS),
      }),
    envShape,
    name: 'service-keys',
  });
}
