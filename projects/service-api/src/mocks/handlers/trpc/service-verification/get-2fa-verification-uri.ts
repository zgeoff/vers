import type { Get2FAVerificationURIPayload } from '@vers/service-types';
import { getTOTPAuthUri } from '@epic-web/totp';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const get2FAVerificationURI = trpc.get2FAVerificationURI.query(
  ({ input }) => {
    const verification = db.verification.findFirst({
      where: {
        target: { equals: input.target },
        type: { equals: '2fa-setup' },
      },
    });

    if (!verification) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No 2FA verification found for this target',
      });
    }

    const otpURI = getTOTPAuthUri({
      accountName: input.target,
      algorithm: verification.algorithm,
      digits: verification.digits,
      issuer: 'vers',
      period: verification.period,
      secret: verification.secret,
    });

    const result: Get2FAVerificationURIPayload = {
      otpURI,
    };

    return result;
  },
);
