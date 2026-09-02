import { authedRoute, defineErrors, publicRoute } from '@vers/contract-base';
import * as z from 'zod';
import { PendingTransactionDataSchema } from './pending-transaction-data-schema';
import { SecureActionSchema } from './secure-action-schema';
import { SessionDataSchema } from './session-data-schema';
import { SessionTokensSchema } from './session-tokens-schema';

const TransactionMismatchDataSchema = z.object({
  field: z.enum(['action', 'ipAddress', 'sessionID', 'target']),
});

export const sessionContract = {
  createSession: publicRoute
    .route({ method: 'POST', path: '/sessions', summary: 'Create a session' })
    .input(
      z.object({
        expiresAt: z.coerce.date().optional(),
        ipAddress: z.string(),
        rememberMe: z.boolean().optional(),
        userID: z.string(),
      }),
    )
    .output(SessionDataSchema),

  deleteSession: authedRoute
    .route({ method: 'DELETE', path: '/sessions/me', summary: "Delete the caller's session" })
    .input(z.object({ id: z.string() }))
    .output(z.object({})),

  getSession: authedRoute
    .route({ method: 'GET', path: '/sessions/me', summary: "Get one of the caller's sessions" })
    .input(z.object({ id: z.string() }))
    .output(SessionDataSchema.nullable()),

  getSessions: authedRoute
    .route({ method: 'GET', path: '/sessions', summary: "List the caller's sessions" })
    .input(z.object({}))
    .output(z.array(SessionDataSchema)),

  refreshTokens: publicRoute
    .route({ method: 'POST', path: '/sessions/refresh', summary: 'Rotate session tokens' })
    .input(z.object({ id: z.string(), refreshToken: z.string() }))
    .output(SessionTokensSchema)
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'Session not found' },
        REFRESH_TOKEN_REUSED: {
          data: z.object({}),
          message: 'Refresh token has already been used',
          status: 401,
        },
        SESSION_EXPIRED: {
          data: z.object({}),
          message: 'Session has expired',
          status: 401,
        },
      }),
    ),

  stepUp: {
    consumePendingTransaction: publicRoute
      .route({
        method: 'POST',
        path: '/sessions/step-up/pending-transactions/{id}/consume',
        summary: 'Atomically consume a pending step-up transaction',
      })
      .input(
        z.object({
          action: SecureActionSchema,
          id: z.string(),
          ipAddress: z.string(),
          sessionID: z.string().nullable(),
          target: z.string(),
        }),
      )
      .output(PendingTransactionDataSchema)
      .errors(
        defineErrors({
          NOT_FOUND: { data: z.object({}), message: 'Pending transaction not found' },
          TRANSACTION_MISMATCH: {
            data: TransactionMismatchDataSchema,
            message: 'Pending transaction does not match the consuming request',
            status: 422,
          },
        }),
      ),

    consumeTransactionToken: publicRoute
      .route({
        method: 'POST',
        path: '/sessions/step-up/transaction-tokens/consume',
        summary: 'Mark a step-up transaction token as used',
      })
      .input(z.object({ expiresAt: z.coerce.date(), jti: z.string() }))
      .output(z.object({ consumed: z.boolean() })),

    createPendingTransaction: publicRoute
      .route({
        method: 'POST',
        path: '/sessions/step-up/pending-transactions',
        summary: 'Create a pending step-up transaction',
      })
      .input(
        z.object({
          action: SecureActionSchema,
          id: z.string(),
          ipAddress: z.string(),
          sessionID: z.string().nullable(),
          target: z.string(),
        }),
      )
      .output(PendingTransactionDataSchema)
      .errors(
        defineErrors({
          CONFLICT: {
            data: z.object({}),
            message: 'A pending transaction with that id already exists',
          },
        }),
      ),

    getPendingTransaction: publicRoute
      .route({
        method: 'GET',
        path: '/sessions/step-up/pending-transactions/{id}',
        summary: 'Get a pending step-up transaction',
      })
      .input(z.object({ id: z.string() }))
      .output(PendingTransactionDataSchema.nullable()),

    recordFailedAttempt: publicRoute
      .route({
        method: 'POST',
        path: '/sessions/step-up/pending-transactions/{id}/attempts',
        summary: 'Record a failed step-up verification attempt',
      })
      .input(z.object({ id: z.string() }))
      .output(z.object({ attemptsRemaining: z.int() }))
      .errors(
        defineErrors({
          NOT_FOUND: { data: z.object({}), message: 'Pending transaction not found' },
        }),
      ),
  },

  verifySession: publicRoute
    .route({
      method: 'POST',
      path: '/sessions/verify',
      summary: 'Complete a 2FA-gated login, signing the user out of every other session',
    })
    .input(z.object({ id: z.string() }))
    .output(SessionTokensSchema)
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'Session not found' },
      }),
    ),
};

export type SessionContract = typeof sessionContract;
