import invariant from 'tiny-invariant';
import { logger } from '../../logger';
import type { Context } from '../../types';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { TokenPayload } from '../types/token-payload';
import { createPayloadResolver } from '../utils/create-payload-resolver';

interface Args {
  input: typeof RefreshAccessTokenInput.$inferInput;
}

export async function refreshAccessToken(
  _: object,
  args: Args,
  ctx: Context,
): Promise<typeof RefreshAccessTokenPayload.$inferType> {
  try {
    invariant(ctx.session, 'session is required');

    const tokens = await ctx.services.session.refreshTokens.mutate({
      id: ctx.session.id,
      refreshToken: args.input.refreshToken,
    });

    return tokens;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const RefreshAccessTokenInput = builder.inputType('RefreshAccessTokenInput', {
  fields: (t) => ({
    refreshToken: t.string({ required: true }),
  }),
});

const RefreshAccessTokenPayload = builder.unionType('RefreshAccessTokenPayload', {
  resolveType: createPayloadResolver(TokenPayload),
  types: [TokenPayload, MutationErrorPayload],
});

export const resolve = refreshAccessToken;

builder.mutationField('refreshAccessToken', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: RefreshAccessTokenInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: refreshAccessToken,
    type: RefreshAccessTokenPayload,
  }),
);
