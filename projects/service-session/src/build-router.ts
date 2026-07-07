import { implement } from '@orpc/server';
import { sessionContract } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import { consumePendingTransaction } from './handlers/consume-pending-transaction';
import { consumeTransactionToken } from './handlers/consume-transaction-token';
import { createPendingTransaction } from './handlers/create-pending-transaction';
import { createSession } from './handlers/create-session';
import { getPendingTransaction } from './handlers/get-pending-transaction';
import { getSession } from './handlers/get-session';
import { getSessions } from './handlers/get-sessions';
import { recordFailedAttempt } from './handlers/record-failed-attempt';
import { refreshTokens } from './handlers/refresh-tokens';
import { removeSession } from './handlers/remove-session';
import { verifySession } from './handlers/verify-session';

interface BuildSessionRouterDeps {
  readonly apiIdentifier: string;
  readonly db: Kysely<DB>;
  readonly signingKey: CryptoKey;
}

/** Assembles the session service's oRPC router, closing each handler over the shared db client. */
export function buildSessionRouter(deps: Readonly<BuildSessionRouterDeps>) {
  const os = implement(sessionContract).$context<ServiceContext>();

  return {
    createSession: os.createSession.handler((opts) => createSession(deps.db, opts)),
    deleteSession: os.deleteSession.handler((opts) => removeSession(deps.db, opts)),
    getSession: os.getSession.handler((opts) => getSession(deps.db, opts)),
    getSessions: os.getSessions.handler((opts) => getSessions(deps.db, opts)),
    refreshTokens: os.refreshTokens.handler((opts) =>
      refreshTokens(
        deps.db,
        { apiIdentifier: deps.apiIdentifier, signingKey: deps.signingKey },
        opts,
      ),
    ),
    stepUp: {
      consumePendingTransaction: os.stepUp.consumePendingTransaction.handler((opts) =>
        consumePendingTransaction(deps.db, opts),
      ),
      consumeTransactionToken: os.stepUp.consumeTransactionToken.handler((opts) =>
        consumeTransactionToken(deps.db, opts),
      ),
      createPendingTransaction: os.stepUp.createPendingTransaction.handler((opts) =>
        createPendingTransaction(deps.db, opts),
      ),
      getPendingTransaction: os.stepUp.getPendingTransaction.handler((opts) =>
        getPendingTransaction(deps.db, opts),
      ),
      recordFailedAttempt: os.stepUp.recordFailedAttempt.handler((opts) =>
        recordFailedAttempt(deps.db, opts),
      ),
    },
    verifySession: os.verifySession.handler((opts) =>
      verifySession(
        deps.db,
        { apiIdentifier: deps.apiIdentifier, signingKey: deps.signingKey },
        opts,
      ),
    ),
  };
}

export type SessionRouter = ReturnType<typeof buildSessionRouter>;
