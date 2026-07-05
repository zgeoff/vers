import { logger } from '../../logger';
import type { AuthedContext } from '../../types';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof DeleteAvatarInput.$inferInput;
}

/**
 * @description Deletes an avatar.
 *
 * @example
 * ```gql
 * mutation DeleteAvatar($input: DeleteAvatarInput!) {
 *   deleteAvatar(input: $input) {
 *     ... on MutationSuccess {
 *       success
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
export async function deleteAvatar(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: AuthedContext,
): Promise<typeof DeleteAvatarPayload.$inferType> {
  try {
    await ctx.services.avatar.deleteAvatar.mutate({
      id: args.input.id,
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

const DeleteAvatarInput = builder.inputType('DeleteAvatarInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
  }),
});

const DeleteAvatarPayload = builder.unionType('DeleteAvatarPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, MutationErrorPayload],
});

export const resolve = requireAuth(deleteAvatar);

builder.mutationField('deleteAvatar', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: DeleteAvatarInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: DeleteAvatarPayload,
  }),
);
