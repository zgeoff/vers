import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { GetSessionsPayload } from '@vers/service-types';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const GetSessionsInputSchema = z.object({
  userID: z.string(),
});

export async function getSessions(
  input: z.infer<typeof GetSessionsInputSchema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<GetSessionsPayload> {
  try {
    const sessions = await ctx.db.query.sessions.findMany({
      where: eq(schema.sessions.userID, input.userID),
    });

    const expiredSessionIDs = sessions
      .filter((session) => session.expiresAt <= new Date())
      .map((session) => session.id);

    // yeet all our expired sessions
    await ctx.db.delete(schema.sessions).where(inArray(schema.sessions.id, expiredSessionIDs));

    return sessions.filter((session) => session.expiresAt > new Date());
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
  .input(GetSessionsInputSchema)
  .query((opts) => getSessions(opts.input, opts.ctx));
