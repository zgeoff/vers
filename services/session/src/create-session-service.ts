import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import * as jose from 'jose';
import type { Kysely } from 'kysely';
import { buildSessionRouter } from './build-router';
import { buildSigningKeySet } from './build-signing-key-set';
import { envShape } from './env-shape';

interface CreateSessionServiceConfig {
  readonly db?: Kysely<DB>;
}

export function createSessionService(
  config: CreateSessionServiceConfig = {},
): Promise<Service<typeof envShape>> {
  return createService({
    buildRouter: async (runtime) => {
      // imported once at boot, not per request: every handler reuses this same resolved key
      const signingKey = await jose.importPKCS8(runtime.env.JWT_SIGNING_PRIVKEY, 'RS256', {
        extractable: true,
      });

      const retired =
        runtime.env.JWT_SIGNING_RETIRED_PUBKEY === undefined
          ? []
          : [await jose.importSPKI(runtime.env.JWT_SIGNING_RETIRED_PUBKEY, 'RS256')];

      const published = await buildSigningKeySet({ active: signingKey, retired });

      return buildSessionRouter({
        apiIdentifier: runtime.env.API_IDENTIFIER,
        db: config.db ?? createDB({ databaseURL: runtime.env.DATABASE_URL }),
        keyID: published.activeKeyID,
        signingKey,
        signingKeySet: published.keySet,
      });
    },
    envShape,
    name: 'service-session',
  });
}
