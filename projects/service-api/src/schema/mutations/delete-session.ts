import { logger } from '~/logger';
import type { AuthedContext } from '~/types';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof DeleteSessionInput.$inferInput;
}

const DeleteSessionInput = builder.inputType('DeleteSessionInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
  }),
});

const DeleteSessionPayload = builder.unionType('DeleteSessionPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, MutationErrorPayload],
});

export async function deleteSession(
  _: unknown,
  args: Args,
  ctx: AuthedContext,
): Promise<typeof DeleteSessionPayload.$inferType> {
  try {
    await ctx.services.session.deleteSession.mutate({
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

export const resolve = requireAuth(deleteSession);

builder.mutationField('deleteSession', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: DeleteSessionInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: DeleteSessionPayload,
  }),
);
