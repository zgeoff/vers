import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createAvatarRouter } from './create-avatar-router';
import { envShape } from './env-shape';

interface CreateAvatarServiceConfig {
  readonly db?: Kysely<DB>;
}

export function createAvatarService(
  config: CreateAvatarServiceConfig = {},
): Promise<Service<typeof envShape, { readonly db: Kysely<DB> }>> {
  return createService({
    allowedIssuers: ['app-web'],
    createRouter: (_runtime, resources) => createAvatarRouter({ db: resources.db }),
    envShape,
    name: 'service-avatar',
    resources: (runtime, scope) => ({
      db:
        config.db ??
        scope.adopt(createDB({ databaseURL: runtime.env.DATABASE_URL }), (db) => db.destroy()),
    }),
  });
}
