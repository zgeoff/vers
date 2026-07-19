import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import { buildActivityRouter } from './build-router';

const KEY_VERSION = 1;

interface CreateActivityServiceConfig {
  readonly contentVersion?: string;

  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
  readonly keyVersion?: number;

  /**
   * Injected only in tests, to trip the offline-progress cap without simulating a day.
   */
  readonly simTimeCapMs?: number;
}

const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string for the activity checkpoint store'),
};

/**
 * Boots the activities service; the production entrypoint and tests both call this as the one shared config.
 */
export function createActivityService(
  config: CreateActivityServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: (runtime) =>
      buildActivityRouter({
        contentVersion: config.contentVersion ?? CURRENT_CONTENT_VERSION,
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
        keyVersion: config.keyVersion ?? KEY_VERSION,
        simTimeCapMs: config.simTimeCapMs ?? OFFLINE_PROGRESS_CAP_MS,
      }),
    envShape,
    name: 'service-activity',
  });
}
