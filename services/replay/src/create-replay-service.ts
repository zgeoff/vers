import { makeContentDocumentLoader } from '@vers/content-registry';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { parseServicePrivateKey } from '@vers/service-auth';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { buildReplayRouter } from './build-router';
import { envShape } from './env-shape';
import type { WakeSource } from './metrics/record-wake';
import { createReplayCache } from './replay/create-replay-cache';
import { drainReplayQueue } from './worker/drain-replay-queue';
import type { ReplayWorkerDeps } from './worker/types';

// a replay iteration holds its claim transaction open across keys and provider calls that can
// each wait out their own timeout, so the worker's pool lengthens the fleet's 30s
// idle-in-transaction backstop past the iteration's own 90s deadline
const REPLAY_IDLE_IN_TRANSACTION_TIMEOUT_MS = 120_000;

interface CreateReplayServiceConfig {
  readonly db?: Kysely<DB>;
}

export interface ReplayService extends Service<typeof envShape, ReplayWorkerDeps> {
  readonly drain: (source: WakeSource) => Promise<number>;
}

export async function createReplayService(
  config: CreateReplayServiceConfig = {},
): Promise<ReplayService> {
  const service = await createService<typeof envShape, ReplayWorkerDeps>({
    allowedIssuers: ['service-activity'],
    createRouter: (_runtime, resources) => buildReplayRouter(resources),
    envShape,
    name: 'service-replay',
    onBoot: (resources) => drainReplayQueue(resources, 'boot'),
    resources: async (runtime, scope) => {
      const db =
        config.db ??
        scope.adopt(
          createDB({
            databaseURL: runtime.env.DATABASE_URL,
            idleInTransactionSessionTimeoutMs: REPLAY_IDLE_IN_TRANSACTION_TIMEOUT_MS,
          }),
          (pool) => pool.destroy(),
        );

      const cache = scope.adopt(
        createReplayCache(undefined, (error) => {
          runtime.logger.error('replay cache driver stop failed', { error });
        }),
        (created) => {
          created.stopAll();
        },
      );

      return {
        cache,
        db,
        keysServiceURL: runtime.env.KEYS_SERVICE_URL,
        loadContentDocument: makeContentDocumentLoader(db),
        logger: runtime.logger,
        privateKey: await parseServicePrivateKey(runtime.env.SERVICE_AUTH_PRIVATE_KEY),
        simVersion: runtime.env.SIM_ENGINE_HASH,
      };
    },
  });

  return { ...service, drain: (source) => drainReplayQueue(service.resources, source) };
}
