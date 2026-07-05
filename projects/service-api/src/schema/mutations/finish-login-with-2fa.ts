import { logger } from '../../logger';
import type { Context } from '../../types';
import { SecureAction } from '../../types';
import { createTransactionToken } from '../../utils/create-transaction-token';
import { verifyTransactionToken } from '../../utils/verify-transaction-token';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { AuthPayload } from '../types/auth-payload';
import { ForceLogoutPayload } from '../types/force-logout-payload';
import { MutationErrorPayload } from '../types/mutation-error-payload';

interface Args {
  input: typeof FinishLoginWith2FAInput.$inferInput;
}

export async function finishLoginWith2FA(
  _: object,
  args: Args,
  ctx: Context,
): Promise<typeof FinishLoginWith2FAPayload.$inferType> {
  try {
    const user = await ctx.services.user.getUser.query({
      email: args.input.target,
    });

    if (!user) {
      return { error: UNKNOWN_ERROR };
    }

    const verification = await ctx.services.verification.getVerification.query({
      target: args.input.target,
      type: '2fa',
    });

    if (!verification) {
      return { error: UNKNOWN_ERROR };
    }

    const payload = await verifyTransactionToken(
      {
        action: SecureAction.TwoFactorAuth,
        target: args.input.target,
        token: args.input.transactionToken,
      },
      ctx,
    );

    if (!payload?.session_id) {
      return { error: UNKNOWN_ERROR };
    }

    const sessions = await ctx.services.session.getSessions.query({
      userID: user.id,
    });

    const session = sessions.find((candidate) => candidate.id === payload.session_id);

    if (!session) {
      return { error: UNKNOWN_ERROR };
    }

    const previousSessions = sessions.filter((candidate) => candidate.id !== payload.session_id);

    // if we have previous sessions (that aren't the one we've just authed),
    // create a verified transaction bound to a forceful logout where we can finalize
    // our flow.
    if (previousSessions.length > 0) {
      const transactionToken = await createTransactionToken(
        {
          action: SecureAction.ForceLogout,
          ipAddress: ctx.ipAddress,
          isVerified: true,
          sessionID: payload.session_id,
          target: user.email,
        },
        ctx,
      );

      return { sessionID: payload.session_id, transactionToken };
    }

    // otherwise, verify our session and return the tokens
    const tokens = await ctx.services.session.verifySession.mutate({
      id: payload.session_id,
    });

    return { ...tokens, session };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const FinishLoginWith2FAInput = builder.inputType('FinishLoginWith2FAInput', {
  fields: (t) => ({
    target: t.string({ required: true }),
    transactionToken: t.string({ required: true }),
  }),
});

function resolveType(value: object) {
  if ('error' in value) {
    return MutationErrorPayload;
  }

  if ('transactionToken' in value) {
    return ForceLogoutPayload;
  }

  return AuthPayload;
}

const FinishLoginWith2FAPayload = builder.unionType('FinishLoginWith2FAPayload', {
  resolveType,
  types: [AuthPayload, ForceLogoutPayload, MutationErrorPayload],
});

export const resolve = finishLoginWith2FA;

builder.mutationField('finishLoginWith2FA', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: FinishLoginWith2FAInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: finishLoginWith2FA,
    type: FinishLoginWith2FAPayload,
  }),
);
