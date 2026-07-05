import type { RefreshTokensPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const refreshTokens = trpc.refreshTokens.mutation(({ input }) => {
  const session = db.session.findFirst({
    where: { refreshToken: { equals: input.refreshToken } },
  });

  if (!session) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Session not found',
    });
  }

  const refreshToken = `refresh_token_${Date.now()}`;

  db.session.update({
    data: { refreshToken },
    where: { id: { equals: session.id } },
  });

  const result: RefreshTokensPayload = {
    accessToken: `access_token_${Date.now()}`,
    refreshToken,
  };

  return result;
});
