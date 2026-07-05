import type { VerifySessionPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from '../types';
import * as consts from '../consts';
import { logger } from '../logger';
import { t } from '../t';
import { createJWT } from '../utils/create-jwt';

export const VerifySessionInputSchema = z.object({
  id: z.string(),
});

export async function verifySession(
  input: z.infer<typeof VerifySessionInputSchema>,
  ctx: Context,
): Promise<VerifySessionPayload> {
  try {
    const session = await ctx.db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.id, input.id),
        eq(schema.sessions.verified, false),
      ),
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    const refreshToken = await createJWT({
      expiresAt: session.expiresAt,
      userID: session.userID,
    });

    const accessToken = await createJWT({
      expiresAt: new Date(Date.now() + consts.ACCESS_TOKEN_DURATION),
      userID: session.userID,
    });

    await ctx.db
      .update(schema.sessions)
      .set({
        refreshToken,
        updatedAt: new Date(),
        verified: true,
      })
      .where(eq(schema.sessions.id, session.id));

    return { accessToken, refreshToken };
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
  .input(VerifySessionInputSchema)
  .mutation(async ({ ctx, input }) => verifySession(input, ctx));
