import { TRPCError } from '@trpc/server';
import type { RefreshTokensPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const refreshTokens = trpc.refreshTokens.mutation((opts) => {
  const session = db.session.findFirst({
    where: { refreshToken: { equals: opts.input.refreshToken } },
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
