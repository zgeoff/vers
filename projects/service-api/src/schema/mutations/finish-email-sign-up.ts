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
  input: typeof FinishEmailSignupInput.$inferInput;
}

export async function finishEmailSignup(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<typeof FinishEmailSignupPayload.$inferType> {
  try {
    const isValidTransaction = await verifyTransactionToken(
      {
        action: SecureAction.Onboarding,
        target: args.input.email,
        token: args.input.transactionToken,
      },
      ctx,
    );

    if (!isValidTransaction) {
      return { error: UNKNOWN_ERROR };
    }

    const existingUser = await ctx.services.user.getUser.query({
      email: args.input.email,
    });

    if (existingUser) {
      return { error: UNKNOWN_ERROR };
    }

    const user = await ctx.services.user.createUser.mutate({
      email: args.input.email,
      name: args.input.name,
      password: args.input.password,
      username: args.input.username,
    });

    const session = await ctx.services.session.createSession.mutate({
      ipAddress: ctx.ipAddress,
      rememberMe: args.input.rememberMe,
      userID: user.id,
    });

    const tokens = await ctx.services.session.verifySession.mutate({
      id: session.id,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      session,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const FinishEmailSignupInput = builder.inputType('FinishEmailSignupInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    name: t.string({ required: true }),
    password: t.string({ required: true }),
    rememberMe: t.boolean({ required: true }),
    transactionToken: t.string({ required: true }),
    username: t.string({ required: true }),
  }),
});

const FinishEmailSignupPayload = builder.unionType('FinishEmailSignupPayload', {
  resolveType: createPayloadResolver(AuthPayload),
  types: [AuthPayload, MutationErrorPayload],
});

export const resolve = finishEmailSignup;

builder.mutationField('finishEmailSignup', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: FinishEmailSignupInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: finishEmailSignup,
    type: FinishEmailSignupPayload,
  }),
);
