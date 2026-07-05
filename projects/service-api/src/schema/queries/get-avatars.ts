import { GraphQLError } from 'graphql';
import type { AuthedContext } from '~/types';
import { logger } from '~/logger';
import { builder } from '../builder';
import { Avatar } from '../types/avatar';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof GetAvatarsInput.$inferInput;
}

/**
 * @description Retrieves all avatars for the authenticated user.
 *
 * @example
 * ```gql
 * query GetAvatars($input: GetAvatarsInput!) {
 *   getAvatars(input: $input) {
 *     id
 *     name
 *     level
 *     xp
 *     createdAt
 *     user {
 *       id
 *       name
 *     }
 *   }
 * }
 * ```
 */
export async function getAvatars(
  _: object,
  _args: Args,
  ctx: AuthedContext,
): Promise<Array<typeof Avatar.$inferType>> {
  try {
    const avatars = await ctx.services.avatar.getAvatars.query({
      userID: ctx.user.id,
    });

    return avatars;
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

const GetAvatarsInput = builder.inputType('GetAvatarsInput', {
  fields: (t) => ({
    placeholder: t.string({ required: false }),
  }),
});

export const resolve = requireAuth(getAvatars);

builder.queryField('getAvatars', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: GetAvatarsInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 20,
      },
    },
    resolve,
    type: [Avatar],
  }),
);
