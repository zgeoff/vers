import { logger } from '../../logger';
import type { Context } from '../../types';
import { SecureAction } from '../../types';
import { verifyTransactionToken } from '../../utils/verify-transaction-token';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { AuthPayload } from '../types/auth-payload';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { createPayloadResolver } from '../utils/create-payload-resolver';

interface Args {
  input: typeof LoginWithForcedLogoutInput.$inferInput;
}

export async function loginWithForcedLogout(
  _: object,
  args: Args,
  ctx: Context,
): Promise<typeof LoginWithForcedLogoutPayload.$inferType> {
  try {
    const payload = await verifyTransactionToken(
      {
        action: SecureAction.ForceLogout,
        target: args.input.target,
        token: args.input.transactionToken,
      },
      ctx,
    );

    if (!payload?.session_id) {
      return { error: UNKNOWN_ERROR };
    }

    const user = await ctx.services.user.getUser.query({
      email: args.input.target,
    });

    if (!user) {
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

    // loop over our previous sessions and delete them. performance should be
    // acceptable here because we should only ever have 1-2 previous sessions
    await Promise.all(
      previousSessions.map((previousSession) =>
        ctx.services.session.deleteSession.mutate({
          id: previousSession.id,
          userID: user.id,
        }),
      ),
    );

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

const LoginWithForcedLogoutInput = builder.inputType('LoginWithForcedLogoutInput', {
  fields: (t) => ({
    target: t.string({ required: true }),
    transactionToken: t.string({ required: true }),
  }),
});

const LoginWithForcedLogoutPayload = builder.unionType('LoginWithForcedLogoutPayload', {
  resolveType: createPayloadResolver(AuthPayload),
  types: [AuthPayload, MutationErrorPayload],
});

export const resolve = loginWithForcedLogout;

builder.mutationField('loginWithForcedLogout', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: LoginWithForcedLogoutInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: loginWithForcedLogout,
    type: LoginWithForcedLogoutPayload,
  }),
);
