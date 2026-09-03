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
  readonly db?: Kysely<DB>;
}

export interface ReplayService extends Service<typeof envShape> {
  readonly db: Kysely<DB>;

  readonly drain: () => Promise<number>;

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
