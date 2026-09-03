import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { buildVerificationRouter } from './build-router';
import { envShape } from './env-shape';

interface CreateVerificationServiceConfig {
  readonly db?: Kysely<DB>;
}

export function createVerificationService(
  config: CreateVerificationServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: (runtime) =>
      buildVerificationRouter({
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
      }),
    envShape,
    name: 'service-verification',
  });
}
