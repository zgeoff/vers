import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { GetSessionPayload } from '@vers/service-types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const GetSessionInputSchema = z.object({
  id: z.string(),
});

export async function getSession(
  input: z.infer<typeof GetSessionInputSchema>,
  ctx: Context,
): Promise<GetSessionPayload> {
  try {
    const session = await ctx.db.query.sessions.findFirst({
      where: (sessions, operators) => operators.eq(sessions.id, input.id),
    });

    if (session?.expiresAt && session.expiresAt <= new Date()) {
      await ctx.db.delete(schema.sessions).where(eq(schema.sessions.id, input.id));

      return null;
    }

    if (!session) {
      return null;
    }

    const { refreshToken, ...sessionWithoutRefreshToken } = session;

    return sessionWithoutRefreshToken;
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
  .input(GetSessionInputSchema)
  .query((opts) => getSession(opts.input, opts.ctx));
