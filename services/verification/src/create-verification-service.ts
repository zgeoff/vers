import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createVerificationRouter } from './create-verification-router';
import { envShape } from './env-shape';

interface CreateVerificationServiceConfig {
  readonly db?: Kysely<DB>;
}

export function createVerificationService(
  config: CreateVerificationServiceConfig = {},
): Promise<Service<typeof envShape, { readonly db: Kysely<DB> }>> {
  return createService({
    allowedIssuers: ['app-web'],
    createRouter: (_runtime, resources) => createVerificationRouter({ db: resources.db }),
    envShape,
    name: 'service-verification',
    resources: (runtime, scope) => ({
      db:
        config.db ??
        scope.adopt(createDB({ databaseURL: runtime.env.DATABASE_URL }), (db) => db.destroy()),
    }),
  });
}
