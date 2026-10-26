import { makeContentDocumentLoader } from '@vers/content-registry';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { parseServicePrivateKey } from '@vers/service-auth';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createActivityRouter } from './create-activity-router';
import { envShape } from './env-shape';
import { makeSendReplayWake } from './wake/make-send-replay-wake';

const KEY_VERSION = 1;
const SCOPE_SECRET_REF: SecretRef = 'worldmap';
const SCOPE_SECRET_VERSION = 1;

interface CreateActivityServiceConfig {
  readonly db?: Kysely<DB>;
  readonly keyVersion?: number;
  readonly secretRef?: SecretRef;
  readonly secretVersion?: number;

  readonly simTimeCapMs?: number;

  readonly wakeCoalesceWindowMs?: number;
  readonly wakeSignal?: AbortSignal;
}

export function createActivityService(
  config: CreateActivityServiceConfig = {},
): Promise<Service<typeof envShape, { readonly db: Kysely<DB> }>> {
  return createService({
    allowedIssuers: ['app-web'],
    createRouter: async (runtime, resources) => {
      const sendReplayWake = makeSendReplayWake({
        logger: runtime.logger,
        ...(config.wakeCoalesceWindowMs !== undefined && {
          coalesceWindowMs: config.wakeCoalesceWindowMs,
        }),
        ...(config.wakeSignal !== undefined && { signal: config.wakeSignal }),
      });

      const privateKey = await parseServicePrivateKey(runtime.env.SERVICE_AUTH_PRIVATE_KEY);

      return createActivityRouter({
        db: resources.db,
        keyVersion: config.keyVersion ?? KEY_VERSION,
        keysServiceURL: runtime.env.KEYS_SERVICE_URL,
        loadContentDocument: makeContentDocumentLoader(resources.db),
        privateKey,
        secretRef: config.secretRef ?? SCOPE_SECRET_REF,
        secretVersion: config.secretVersion ?? SCOPE_SECRET_VERSION,
        sendReplayWake,
        simTimeCapMs: config.simTimeCapMs ?? OFFLINE_PROGRESS_CAP_MS,
      });
    },
    envShape,
    name: 'service-activity',
    resources: (runtime, scope) => ({
      db:
        config.db ??
        scope.adopt(createDB({ databaseURL: runtime.env.DATABASE_URL }), (db) => db.destroy()),
    }),
  });
}
