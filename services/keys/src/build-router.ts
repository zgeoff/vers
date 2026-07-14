import { implement } from '@orpc/server';
import { keysContract } from '@vers/contract-keys';
import type { ServiceContext } from '@vers/service-runtime';
import { deriveAvatarKey } from './handlers/derive-avatar-key';
import type { RollKeyRoots } from './parse-roll-key-roots';

interface BuildKeysRouterDeps {
  readonly roots: RollKeyRoots;
}

/**
 * Assembles the keys service's oRPC router, closing each handler over the parsed root secrets.
 */
export function buildKeysRouter(deps: BuildKeysRouterDeps) {
  const os = implement(keysContract).$context<ServiceContext>();

  return {
    deriveAvatarKey: os.deriveAvatarKey.handler((opts) => deriveAvatarKey(deps.roots, opts)),
  };
}

export type KeysRouter = ReturnType<typeof buildKeysRouter>;
