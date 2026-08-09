import { implement } from '@orpc/server';
import { keysContract } from '@vers/contract-keys';
import type { ServiceContext } from '@vers/service-runtime';
import { deriveAvatarKey } from './handlers/derive-avatar-key';
import { deriveScopeSecret } from './handlers/derive-scope-secret';
import type { RollKeyRoots } from './parse-roll-key-roots';
import type { ScopeSecretRoots } from './parse-scope-secret-roots';

interface BuildKeysRouterDeps {
  readonly roots: RollKeyRoots;
  readonly scopeRoots: ScopeSecretRoots;
}

/**
 * Assembles the keys service's oRPC router, closing each handler over the parsed root secrets.
 */
export function buildKeysRouter(deps: BuildKeysRouterDeps) {
  const os = implement(keysContract).$context<ServiceContext>();

  return {
    deriveAvatarKey: os.deriveAvatarKey.handler((opts) => deriveAvatarKey(deps.roots, opts)),
    deriveScopeSecret: os.deriveScopeSecret.handler((opts) =>
      deriveScopeSecret(deps.scopeRoots, opts),
    ),
  };
}

export type KeysRouter = ReturnType<typeof buildKeysRouter>;
