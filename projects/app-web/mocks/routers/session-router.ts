import { implement } from '@orpc/server';
import { sessionContract } from '@vers/contract-session';
import { sessionCollection } from '../db/session-collection';
import type { MockContext } from '../resolve-session-context';

/**
 * The mock session service's full router. Only `getSession` carries real behaviour for this
 * phase's gate (the acting user's session read behind `getCurrentUser`'s auth check); every other
 * procedure is a placeholder until its flow phase lands real business logic, per #259's scope.
 */
export function buildMockSessionRouter() {
  const os = implement(sessionContract).$context<MockContext>();

  return {
    createSession: os.createSession.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    deleteSession: os.deleteSession.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    getSession: os.getSession.handler((opts) => {
      const { actingUserId } = opts.context;

      if (actingUserId === null) {
        throw new Error('not wired in the phase 0b mock backend');
      }

      const session = sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

      if (session === undefined || session.userID !== actingUserId) {
        return null;
      }

      return session;
    }),
    getSessions: os.getSessions.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    refreshTokens: os.refreshTokens.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    stepUp: {
      consumePendingTransaction: os.stepUp.consumePendingTransaction.handler(() => {
        throw new Error('not wired in the phase 0b mock backend');
      }),
      consumeTransactionToken: os.stepUp.consumeTransactionToken.handler(() => {
        throw new Error('not wired in the phase 0b mock backend');
      }),
      createPendingTransaction: os.stepUp.createPendingTransaction.handler(() => {
        throw new Error('not wired in the phase 0b mock backend');
      }),
      getPendingTransaction: os.stepUp.getPendingTransaction.handler(() => {
        throw new Error('not wired in the phase 0b mock backend');
      }),
      recordFailedAttempt: os.stepUp.recordFailedAttempt.handler(() => {
        throw new Error('not wired in the phase 0b mock backend');
      }),
    },
    verifySession: os.verifySession.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
  };
}
