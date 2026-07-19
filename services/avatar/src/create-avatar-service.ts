import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import { buildAvatarRouter } from './build-router';

interface CreateAvatarServiceConfig {
  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
}

const envShape = {
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the avatar and progression tables'),
};

/**
 * Boots the avatar service; the production entrypoint and tests both call this as the one shared config.
 */
export function createAvatarService(
  config: CreateAvatarServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: (runtime) =>
      buildAvatarRouter({ db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }) }),
    envShape,
    name: 'service-avatar',
  });
}
