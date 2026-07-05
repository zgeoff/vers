import { GraphQLError } from 'graphql';
import { logger } from '../../logger';
import type { AuthedContext } from '../../types';
import { builder } from '../builder';
import { Avatar } from '../types/avatar';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof GetAvatarInput.$inferInput;
}

/**
 * @description Retrieves an avatar by ID. Returns null if not found.
 *
 * @example
 * ```gql
 * query GetAvatar($input: GetAvatarInput!) {
 *   getAvatar(input: $input) {
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
export async function getAvatar(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: AuthedContext,
): Promise<null | typeof Avatar.$inferType> {
  try {
    const avatar = await ctx.services.avatar.getAvatar.query({
      id: args.input.id,
    });

    return avatar;
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

const GetAvatarInput = builder.inputType('GetAvatarInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
  }),
});

export const resolve = requireAuth(getAvatar);

builder.queryField('getAvatar', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: GetAvatarInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 20,
      },
    },
    nullable: true,
    resolve,
    type: Avatar,
  }),
);
