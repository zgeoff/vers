import type { VerifySessionPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const verifySession = trpc.verifySession.mutation(({ input }) => {
  const session = db.session.findFirst({
    where: { id: { equals: input.id } },
  });

  if (!session) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Session not found',
    });
  }

  const refreshToken = `refresh_token_${Date.now()}`;

  db.session.update({
    data: { refreshToken, updatedAt: new Date(), verified: true },
    where: { id: { equals: session.id } },
  });

  const result: VerifySessionPayload = {
    accessToken: `access_token_${Date.now()}`,
    refreshToken,
  };

  return result;
});
