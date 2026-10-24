import { implement } from '@orpc/server';
import { sessionContract } from '@vers/contract-session';
import type { SigningKeySet } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import { consumeGrant } from './handlers/consume-grant';
import { consumePendingTransaction } from './handlers/consume-pending-transaction';
import { createPendingTransaction } from './handlers/create-pending-transaction';
import { createSession } from './handlers/create-session';
import { readPendingTransaction } from './handlers/read-pending-transaction';
import { readSession } from './handlers/read-session';
import { readSessions } from './handlers/read-sessions';
import { recordFailedAttempt } from './handlers/record-failed-attempt';
import { refreshTokens } from './handlers/refresh-tokens';
import { removeSession } from './handlers/remove-session';
import { verifySession } from './handlers/verify-session';

interface CreateSessionRouterDeps {
  readonly apiIdentifier: string;
  readonly db: Kysely<DB>;
  readonly keyID: string;
  readonly signingKey: CryptoKey;
  readonly signingKeySet: SigningKeySet;
}

export function createSessionRouter(deps: Readonly<CreateSessionRouterDeps>) {
  const os = implement(sessionContract).$context<ServiceContext>();

  return {
    createSession: os.createSession.handler((opts) => createSession(deps.db, opts)),
    deleteSession: os.deleteSession.handler((opts) => removeSession(deps.db, opts)),
    getSession: os.getSession.handler((opts) => readSession(deps.db, opts)),
    getSessions: os.getSessions.handler((opts) => readSessions(deps.db, opts)),
    getSigningKeys: os.getSigningKeys.handler(() => deps.signingKeySet),
    refreshTokens: os.refreshTokens.handler((opts) =>
      refreshTokens(
        deps.db,
        { apiIdentifier: deps.apiIdentifier, keyID: deps.keyID, signingKey: deps.signingKey },
        opts,
      ),
    ),
    stepUp: {
      consumeGrant: os.stepUp.consumeGrant.handler((opts) => consumeGrant(deps.db, opts)),
      consumePendingTransaction: os.stepUp.consumePendingTransaction.handler((opts) =>
        consumePendingTransaction(deps.db, opts),
      ),
      createPendingTransaction: os.stepUp.createPendingTransaction.handler((opts) =>
        createPendingTransaction(deps.db, opts),
      ),
      getPendingTransaction: os.stepUp.getPendingTransaction.handler((opts) =>
        readPendingTransaction(deps.db, opts),
      ),
      recordFailedAttempt: os.stepUp.recordFailedAttempt.handler((opts) =>
        recordFailedAttempt(deps.db, opts),
      ),
    },
    verifySession: os.verifySession.handler((opts) =>
      verifySession(
        deps.db,
        { apiIdentifier: deps.apiIdentifier, keyID: deps.keyID, signingKey: deps.signingKey },
        opts,
      ),
    ),
  };
}

export type SessionRouter = ReturnType<typeof createSessionRouter>;
