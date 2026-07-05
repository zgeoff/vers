import { logger } from '~/logger';
import type { Context } from '~/types';
import { SecureAction } from '~/types';
import { createPendingTransaction } from '~/utils/create-pending-transaction';
import { createTransactionToken } from '~/utils/create-transaction-token';
import { builder } from '../builder';
import { INVALID_CREDENTIALS_ERROR, UNKNOWN_ERROR } from '../errors';
import { AuthPayload } from '../types/auth-payload';
import { ForceLogoutPayload } from '../types/force-logout-payload';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { TwoFactorLoginPayload } from '../types/two-factor-login-payload';

interface Args {
  input: typeof LoginWithPasswordInput.$inferInput;
}

export async function loginWithPassword(
  _: object,
  args: Args,
  ctx: Context,
): Promise<typeof LoginWithPasswordPayload.$inferType> {
  try {
    const user = await ctx.services.user.getUser.query({
      email: args.input.email,
    });

    if (!user) {
      return {
        error: INVALID_CREDENTIALS_ERROR,
      };
    }

    const verifyPasswordResult = await ctx.services.user.verifyPassword.mutate({
      email: args.input.email,
      password: args.input.password,
    });

    if (!verifyPasswordResult.success) {
      return {
        error: INVALID_CREDENTIALS_ERROR,
      };
    }

    // Check if 2FA is enabled for this user by looking for a verification record
    const verification = await ctx.services.verification.getVerification.query({
      target: user.email,
      type: '2fa',
    });

    const existingSessions = await ctx.services.session.getSessions.query({
      userID: user.id,
    });

    const session = await ctx.services.session.createSession.mutate({
      ipAddress: ctx.ipAddress,
      rememberMe: args.input.rememberMe,
      userID: user.id,
    });

    // If 2FA is enabled, bind to our 2FA secure action so we can finalize auth there
    if (verification) {
      const transactionID = createPendingTransaction(
        {
          action: SecureAction.TwoFactorAuth,
          sessionID: session.id,
          target: user.email,
        },
        ctx,
      );

      return { sessionID: session.id, transactionID };
    }

    // if we have previous sessions, we can bind this auth to the force logout
    // action then finalize auth from there
    if (existingSessions.length > 0) {
      const transactionToken = await createTransactionToken(
        {
          action: SecureAction.ForceLogout,
          ipAddress: ctx.ipAddress,
          isVerified: true,
          sessionID: session.id,
          target: user.email,
        },
        ctx,
      );

      return { sessionID: session.id, transactionToken };
    }

    // otherwise we're good to login - verify the session and return the tokens
    const tokens = await ctx.services.session.verifySession.mutate({
      id: session.id,
    });

    return { ...tokens, session };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const LoginWithPasswordInput = builder.inputType('LoginWithPasswordInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    rememberMe: t.boolean({ required: true }),
  }),
});

function resolveType(value: object) {
  if ('error' in value) {
    return MutationErrorPayload;
  }

  if ('transactionToken' in value) {
    return ForceLogoutPayload;
  }

  if ('transactionID' in value) {
    return TwoFactorLoginPayload;
  }

  return AuthPayload;
}

const LoginWithPasswordPayload = builder.unionType('LoginWithPasswordPayload', {
  resolveType,
  types: [AuthPayload, TwoFactorLoginPayload, ForceLogoutPayload, MutationErrorPayload],
});

export const resolve = loginWithPassword;

builder.mutationField('loginWithPassword', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: LoginWithPasswordInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: loginWithPassword,
    type: LoginWithPasswordPayload,
  }),
);
