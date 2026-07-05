import { GraphQLError } from 'graphql';
import invariant from 'tiny-invariant';
import { logger } from '~/logger';
import type { Context } from '~/types';
import { builder } from '../builder';
import { Session } from '../types/session';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: {
    placeholder?: null | string | undefined;
  };
}

export async function getSessions(
  _: object,
  _args: Args,
  ctx: Context,
): Promise<Array<typeof Session.$inferType>> {
  invariant(ctx.user, 'user is required in an authed resolver');

  try {
    const sessions = await ctx.services.session.getSessions.query({
      userID: ctx.user.id,
    });

    return sessions;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    throw new GraphQLError('An unknown error occurred', {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }
}

const GetSessionsInput = builder.inputType('GetSessionsInput', {
  fields: (t) => ({
    placeholder: t.string({ required: false }),
  }),
});

export const resolve = requireAuth(getSessions);

builder.queryField('getSessions', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: GetSessionsInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 20,
      },
    },
    resolve,
    type: [Session],
  }),
);
