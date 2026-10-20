import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createUserRouter } from './create-user-router';
import { envShape } from './env-shape';

interface CreateUserServiceConfig {
  readonly db?: Kysely<DB>;
}

export function createUserService(
  config: CreateUserServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    allowedIssuers: ['app-web'],
    createRouter: (runtime) =>
      createUserRouter({
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
      }),
    envShape,
    name: 'service-user',
  });
}
