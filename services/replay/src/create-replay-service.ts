import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { parseServicePrivateKey } from '@vers/service-auth';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import { buildReplayRouter } from './build-router';

interface CreateReplayServiceConfig {
  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
}

const REPLAY_SERVICE_ENV_SHAPE = {
  DATABASE_URL: z.string(),
  KEYS_SERVICE_URL: z.string().min(1),
  SERVICE_AUTH_PRIVATE_KEY: z.string().min(1),
  SIM_ENGINE_HASH: z.string().min(1),
};

/**
 * The booted replay service, plus the `db` and s2s signing key its RPC router resolved at boot —
 * `serve.ts` starts the replay worker alongside the router from these same resolved values,
 * rather than re-deriving them from `env` a second time.
 */
export interface ReplayService extends Service<typeof REPLAY_SERVICE_ENV_SHAPE> {
  readonly db: Kysely<DB>;
  readonly privateKey: CryptoKey;

  /**
   * Destroys the pool this factory opened itself from `DATABASE_URL` — a no-op when `config.db`
   * was injected, since the caller owns that handle's lifecycle.
   */
  readonly stopDB: () => Promise<void>;
}

/**
 * Boots the replay service; the production entrypoint and every test call this as the one shared
 * config. `config.db` is injected only in tests — the production entrypoint always resolves its
 * own pool from `DATABASE_URL`. The signing key is parsed and awaited here, before `listen()`
 * ever runs, so a malformed `SERVICE_AUTH_PRIVATE_KEY` fails the boot rather than the first
 * cross-version dispatch that needs it.
 */
export async function createReplayService(
  config: CreateReplayServiceConfig = {},
): Promise<ReplayService> {
  let resolvedDB: Kysely<DB> | undefined;
  let ownsDB = false;
  let resolvedPrivateKey: CryptoKey | undefined;

  const service = await createService({
    buildRouter: async (runtime) => {
      ownsDB = config.db === undefined;
      resolvedDB = config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL });

      resolvedPrivateKey = await parseServicePrivateKey(runtime.env.SERVICE_AUTH_PRIVATE_KEY);

      return buildReplayRouter({ simVersion: runtime.env.SIM_ENGINE_HASH });
    },
    envShape: REPLAY_SERVICE_ENV_SHAPE,
    name: 'service-replay',
  });

  invariant(
    resolvedDB !== undefined && resolvedPrivateKey !== undefined,
    'buildRouter always resolves db and privateKey before returning',
  );

  const db = resolvedDB;
  const privateKey = resolvedPrivateKey;

  return {
    ...service,
    db,
    privateKey,
    stopDB: async () => {
      if (ownsDB) {
        await db.destroy();
      }
    },
  };
}
