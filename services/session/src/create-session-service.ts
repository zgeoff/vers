import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import * as jose from 'jose';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import { buildSessionRouter } from './build-router';

interface CreateSessionServiceConfig {
  /**
   * Injected only in tests, to run the service inside the test's own transaction.
   */
  readonly db?: Kysely<DB>;
}

const envShape = {
  API_IDENTIFIER: z.string().describe('Issuer and audience stamped into signed user tokens'),
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the session and step-up tables'),
  JWT_SIGNING_PRIVKEY: z.string().describe('RS256 PKCS8 private key user tokens are signed with'),
};

/**
 * Boots the session service; the production entrypoint and tests both call this as the one shared config.
 */
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
