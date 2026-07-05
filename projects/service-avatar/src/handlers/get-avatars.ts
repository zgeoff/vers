import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { GetAvatarsPayload } from '@vers/service-types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

const GetAvatarsInputSchema = z.object({
  userID: z.string(),
});

async function getAvatars(
  input: z.infer<typeof GetAvatarsInputSchema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<GetAvatarsPayload> {
  try {
    const avatars = await ctx.db.query.avatars.findMany({
      where: eq(schema.avatars.userID, input.userID),
    });

    return avatars;
  } catch (error: unknown) {
    logger.error(error);

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      cause: error,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unknown error occurred',
    });
  }
}

export const procedure = t.procedure
  .input(GetAvatarsInputSchema)
  .query((opts) => getAvatars(opts.input, opts.ctx));
