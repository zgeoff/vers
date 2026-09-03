import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import * as jose from 'jose';
import type { Kysely } from 'kysely';
import { buildSessionRouter } from './build-router';
import { envShape } from './env-shape';

interface CreateSessionServiceConfig {
  readonly db?: Kysely<DB>;
}

export function createSessionService(
  config: CreateSessionServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: async (runtime) =>
      buildSessionRouter({
        apiIdentifier: runtime.env.API_IDENTIFIER,
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),

        // imported once at boot, not per request: every handler reuses this same resolved key
        signingKey: await jose.importPKCS8(runtime.env.JWT_SIGNING_PRIVKEY, 'RS256'),
      }),
    envShape,
    name: 'service-session',
  });
}
