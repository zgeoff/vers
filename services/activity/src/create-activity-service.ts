import { makeContentDocumentLoader } from '@vers/content-registry';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { parseServicePrivateKey } from '@vers/service-auth';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { buildActivityRouter } from './build-router';
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
}

export function createActivityService(
  config: CreateActivityServiceConfig = {},
): Promise<Service<typeof envShape>> {
  const wakeOptions =
    config.wakeCoalesceWindowMs === undefined
      ? undefined
      : { coalesceWindowMs: config.wakeCoalesceWindowMs };

  const sendReplayWake = makeSendReplayWake(wakeOptions);

  return createService({
    buildRouter: async (runtime) => {
      const privateKey = await parseServicePrivateKey(runtime.env.SERVICE_AUTH_PRIVATE_KEY);

      const db = config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL });

      return buildActivityRouter({
        db,
        keyVersion: config.keyVersion ?? KEY_VERSION,
        keysServiceURL: runtime.env.KEYS_SERVICE_URL,
        loadContentDocument: makeContentDocumentLoader(db),
        privateKey,
        secretRef: config.secretRef ?? SCOPE_SECRET_REF,
        secretVersion: config.secretVersion ?? SCOPE_SECRET_VERSION,
        sendReplayWake,
        simTimeCapMs: config.simTimeCapMs ?? OFFLINE_PROGRESS_CAP_MS,
      });
    },
    envShape,
    name: 'service-activity',
  });
}
