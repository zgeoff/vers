import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { buildUserRouter } from './build-router';
import { envShape } from './env-shape';

interface CreateUserServiceConfig {
  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
}

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
