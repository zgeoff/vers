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
import type { WakeSource } from './metrics/record-wake';
import { drainReplayQueue } from './worker/drain-replay-queue';
import type { ReplayWorkerDeps } from './worker/types';

// a replay iteration holds its claim transaction open across keys and provider calls that can
// each wait out their own timeout, so the worker's pool lengthens the fleet's 30s
// idle-in-transaction backstop past the iteration's own 90s deadline
const REPLAY_IDLE_IN_TRANSACTION_TIMEOUT_MS = 120_000;

interface CreateReplayServiceConfig {
  readonly db?: Kysely<DB>;
}

export interface ReplayService extends Service<typeof envShape> {
  readonly db: Kysely<DB>;

  readonly drain: (source: WakeSource) => Promise<number>;

  readonly privateKey: CryptoKey;

  readonly stopDB: () => Promise<void>;
}

export async function createReplayService(
  config: CreateReplayServiceConfig = {},
): Promise<ReplayService> {
  let resolvedDeps: ReplayWorkerDeps | undefined;
  let ownsDB = false;

  const service = await createService({
    buildRouter: async (runtime) => {
      ownsDB = config.db === undefined;

      const db =
        config.db ??
        createDB({
          databaseURL: runtime.env.DATABASE_URL,
          idleInTransactionSessionTimeoutMs: REPLAY_IDLE_IN_TRANSACTION_TIMEOUT_MS,
        });

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
    drain: (source) => drainReplayQueue(deps, source),
    privateKey: deps.privateKey,
    stopDB: async () => {
      if (ownsDB) {
        await deps.db.destroy();
      }
    },
  };
}
