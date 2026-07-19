import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import { buildUserRouter } from './build-router';

interface CreateUserServiceConfig {
  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
}

const envShape = {
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the account and credential tables'),
};

/**
 * Boots the user service; the production entrypoint and tests both call this as the one shared config.
 */
export function createUserService(
  config: CreateUserServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: (runtime) =>
      buildUserRouter({
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
      }),
    envShape,
    name: 'service-user',
  });
}
