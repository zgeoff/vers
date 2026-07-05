import { TRPCClientError } from '@trpc/client';
import { logger } from '../../logger';
import type { AuthedContext } from '../../types';
import { builder } from '../builder';
import { AVATAR_LIMIT_REACHED_ERROR, AVATAR_NAME_EXISTS_ERROR, UNKNOWN_ERROR } from '../errors';
import { Avatar } from '../types/avatar';
import { AvatarClass } from '../types/avatar-class';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof CreateAvatarInput.$inferInput;
}

// for now, we limit our users to 1 avatar. we can do this more
// elegantly later
const MAX_AVATARS = 2;

/**
 * @description Creates a new avatar for the authenticated user.
 * Users are limited to one avatar each.
 *
 * @example
 * ```gql
 * mutation CreateAvatar($input: CreateAvatarInput!) {
 *   createAvatar(input: $input) {
 *     ... on Avatar {
 *       id
 *       name
 *       level
 *       xp
 *       class
 *       createdAt
 *       user {
 *         id
 *         name
 *       }
 *     }
 *
 *     ... on MutationErrorPayload {
 *       error {
 *         title
 *         message
 *       }
 *     }
 *   }
 * }
 * ```
 */
export async function createAvatar(
  _: object,
  args: Args,
  ctx: AuthedContext,
): Promise<typeof CreateAvatarPayload.$inferType> {
  try {
    const existingAvatars = await ctx.services.avatar.getAvatars.query({
      userID: ctx.user.id,
    });

    if (existingAvatars.length >= MAX_AVATARS) {
      return { error: AVATAR_LIMIT_REACHED_ERROR };
    }

    const avatar = await ctx.services.avatar.createAvatar.mutate({
      class: args.input.class,
      name: args.input.name,
      userID: ctx.user.id,
    });

    return avatar;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    if (error instanceof TRPCClientError && error.data.code === 'CONFLICT') {
      return { error: AVATAR_NAME_EXISTS_ERROR };
    }

    return { error: UNKNOWN_ERROR };
  }
}

const CreateAvatarInput = builder.inputType('CreateAvatarInput', {
  fields: (t) => ({
    class: t.field({ required: true, type: AvatarClass }),
    name: t.string({ required: true }),
  }),
});

const CreateAvatarPayload = builder.unionType('CreateAvatarPayload', {
  resolveType: createPayloadResolver(Avatar),
  types: [Avatar, MutationErrorPayload],
});

export const resolve = requireAuth(createAvatar);

builder.mutationField('createAvatar', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: CreateAvatarInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: CreateAvatarPayload,
  }),
);
