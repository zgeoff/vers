import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
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
  readonly contentVersion?: string;

  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
  readonly keyVersion?: number;
  readonly secretRef?: SecretRef;
  readonly secretVersion?: number;

  /**
   * Injected only in tests, to trip the offline-progress cap without simulating a day.
   */
  readonly simTimeCapMs?: number;

  /**
   * Injected only in tests, to disable the wake coalesce window so a delivery assertion never waits
   * it out.
   */
  readonly wakeCoalesceWindowMs?: number;
}

/**
 * Boots the activities service; the production entrypoint and tests both call this as the one
 * shared config. The signing key is parsed and awaited here, before `listen()` ever runs, so a
 * malformed `SERVICE_AUTH_PRIVATE_KEY` fails the boot rather than the first start that needs it.
 */
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

      return buildActivityRouter({
        contentVersion: config.contentVersion ?? CURRENT_CONTENT_VERSION,
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
        keyVersion: config.keyVersion ?? KEY_VERSION,
        keysServiceURL: runtime.env.KEYS_SERVICE_URL,
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
