import type { RefreshTokensPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from '../types';
import * as consts from '../consts';
import { logger } from '../logger';
import { t } from '../t';
import { createJWT } from '../utils/create-jwt';

export const RefreshTokensInputSchema = z.object({
  id: z.string(),
  refreshToken: z.string(),
});

export async function refreshTokens(
  input: z.infer<typeof RefreshTokensInputSchema>,
  ctx: Context,
): Promise<RefreshTokensPayload> {
  try {
    const existingSession = await ctx.db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.refreshToken, input.refreshToken),
        eq(schema.sessions.id, input.id),
      ),
    });

    if (!existingSession?.refreshToken) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    // Check if the session has expired
    if (existingSession.expiresAt < new Date()) {
      await ctx.db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, existingSession.id));

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Session expired',
      });
    }

    const now = Date.now();
    const sessionAge = now - existingSession.createdAt.getTime();

    // if our session has existed for less than our short sessionduration,
    // we can just create a new access token and skip rotating the refresh token
    if (sessionAge < consts.SESSION_DURATION_SHORT) {
      const accessToken = await createJWT({
        expiresAt: new Date(Date.now() + consts.ACCESS_TOKEN_DURATION),
        userID: existingSession.userID,
      });

      return { accessToken, refreshToken: existingSession.refreshToken };
    }

    // generate a new refresh token so we can rotate it, using the same expiry as before
    const refreshToken = await createJWT({
      expiresAt: existingSession.expiresAt,
      userID: existingSession.userID,
    });

    const accessToken = await createJWT({
      expiresAt: new Date(Date.now() + consts.ACCESS_TOKEN_DURATION),
      userID: existingSession.userID,
    });

    const updatedAt = new Date();

    await ctx.db
      .update(schema.sessions)
      .set({
        refreshToken,
        updatedAt,
      })
      .where(eq(schema.sessions.id, existingSession.id));

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
  .input(RefreshTokensInputSchema)
  .mutation(async ({ ctx, input }) => refreshTokens(input, ctx));
