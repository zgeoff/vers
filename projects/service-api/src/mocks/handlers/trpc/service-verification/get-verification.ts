import type { GetVerificationPayload, VerificationType } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const getVerification = trpc.getVerification.query((opts) => {
  const verification = db.verification.findFirst({
    where: {
      target: { equals: opts.input.target },
      type: { equals: opts.input.type },
    },
  });

  if (!verification) {
    return null;
  }

  if (verification.expiresAt && verification.expiresAt < new Date()) {
    db.verification.delete({
      where: {
        id: { equals: verification.id },
      },
    });

    return null;
  }

  const result: GetVerificationPayload = {
    id: verification.id,
    target: verification.target,
    type: verification.type as VerificationType,
  };

  return result;
});
