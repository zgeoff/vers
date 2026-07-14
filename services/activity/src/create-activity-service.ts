import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import { buildActivityRouter } from './build-router';

/**
 * Placeholder version stamps every new activity is minted against; real version dispatch is a
 * later change. Factory-injectable so tests can exercise a specific version pair.
 */
const SIM_VERSION = '0.0.0-dev';
const CONTENT_VERSION = '0.0.0-dev';

interface CreateActivityServiceConfig {
  readonly contentVersion?: string;

  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;

  /**
   * Injected only in tests, to trip the offline-progress cap without simulating a day.
   */
  readonly simTimeCapMs?: number;
  readonly simVersion?: string;
}

/**
 * Boots the activities service; the production entrypoint and tests both call this as the one shared config.
 */
export function createActivityService(
  config: CreateActivityServiceConfig = {},
): Promise<Service<{ DATABASE_URL: z.ZodString }>> {
  return createService({
    buildRouter: (runtime) =>
      buildActivityRouter({
        contentVersion: config.contentVersion ?? CONTENT_VERSION,
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
        simTimeCapMs: config.simTimeCapMs ?? OFFLINE_PROGRESS_CAP_MS,
        simVersion: config.simVersion ?? SIM_VERSION,
      }),
    envShape: { DATABASE_URL: z.string() },
    name: 'service-activity',
  });
}
