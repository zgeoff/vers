import type { VerificationType, VerifyCodePayload } from '@vers/service-types';
import { verifyTOTP } from '@epic-web/totp';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const verifyCode = trpc.verifyCode.mutation(async ({ input }) => {
  const verification = db.verification.findFirst({
    where: {
      target: { equals: input.target },
      type: { equals: input.type },
    },
  });

  if (!verification) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Invalid verification code',
    });
  }

  if (verification.expiresAt && verification.expiresAt < new Date()) {
    db.verification.delete({
      where: {
        id: { equals: verification.id },
      },
    });

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Verification code has expired',
    });
  }

  const isValid = await verifyTOTP({
    algorithm: verification.algorithm,
    charSet: verification.charSet,
    digits: verification.digits,
    otp: input.code,
    period: verification.period,
    secret: verification.secret,
  });

  if (!isValid) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid verification code',
    });
  }

  // Delete the verification after successful use
  db.verification.delete({
    where: {
      id: { equals: verification.id },
    },
  });

  const result: VerifyCodePayload = {
    id: verification.id,
    target: verification.target,
    type: verification.type as VerificationType,
  };

  return result;
});
