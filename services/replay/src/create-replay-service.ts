import { makeContentDocumentLoader } from '@vers/content-registry';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { parseServicePrivateKey } from '@vers/service-auth';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { buildReplayRouter } from './build-router';
import { envShape } from './env-shape';
import { drainReplayQueue } from './worker/drain-replay-queue';
import type { ReplayWorkerDeps } from './worker/types';

interface CreateReplayServiceConfig {
  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
}

/**
 * The booted replay service, plus the `db` and s2s signing key its RPC router resolved at boot —
 * `buildReplayRouter` hands both to the `wake` procedure's drain handler, rather than re-deriving
 * them from `env` a second time.
 */
export interface ReplayService extends Service<typeof envShape> {
  readonly db: Kysely<DB>;

  /**
   * Drains the replay queue to empty, sharing the same deps the `wake` procedure's handler closes
   * over — the boot entrypoint's self-healing backstop for a poke a crash or deploy lost.
   */
  readonly drain: () => Promise<number>;

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
  let resolvedDeps: ReplayWorkerDeps | undefined;
  let ownsDB = false;

  const service = await createService({
    buildRouter: async (runtime) => {
      ownsDB = config.db === undefined;

      const db = config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL });

      const privateKey = await parseServicePrivateKey(runtime.env.SERVICE_AUTH_PRIVATE_KEY);

      resolvedDeps = {
        db,
        keysServiceURL: runtime.env.KEYS_SERVICE_URL,
        loadContentDocument: makeContentDocumentLoader(db),
        logger: runtime.logger,
        privateKey,
        simVersion: runtime.env.SIM_ENGINE_HASH,
      };

      return buildReplayRouter(resolvedDeps);
    },
    envShape,
    name: 'service-replay',
  });

  invariant(resolvedDeps !== undefined, 'buildRouter always resolves deps before returning');

  const deps = resolvedDeps;

  return {
    ...service,
    db: deps.db,
    drain: () => drainReplayQueue(deps),
    privateKey: deps.privateKey,
    stopDB: async () => {
      if (ownsDB) {
        await deps.db.destroy();
      }
    },
  };
}
