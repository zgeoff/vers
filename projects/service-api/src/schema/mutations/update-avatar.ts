import { logger } from '~/logger';
import type { AuthedContext } from '~/types';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof UpdateAvatarInput.$inferInput;
}

/**
 * @description Updates an avatar's name.
 *
 * @example
 * ```gql
 * mutation UpdateAvatar($input: UpdateAvatarInput!) {
 *   updateAvatar(input: $input) {
 *     ... on Avatar {
 *       id
 *       name
 *       level
 *       xp
 *       createdAt
 *       user {
 *         id
 *         name
 *       }
 *     }
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
export async function updateAvatar(
  _: object,
  args: Args,
  ctx: AuthedContext,
): Promise<typeof UpdateAvatarPayload.$inferType> {
  try {
    await ctx.services.avatar.updateAvatar.mutate({
      id: args.input.id,
      name: args.input.name,
      userID: ctx.user.id,
    });

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const UpdateAvatarInput = builder.inputType('UpdateAvatarInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
    name: t.string({ required: true }),
  }),
});

const UpdateAvatarPayload = builder.unionType('UpdateAvatarPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, MutationErrorPayload],
});

export const resolve = requireAuth(updateAvatar);

builder.mutationField('updateAvatar', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: UpdateAvatarInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: UpdateAvatarPayload,
  }),
);
