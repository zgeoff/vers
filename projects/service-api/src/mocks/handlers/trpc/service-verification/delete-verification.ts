import type { DeleteVerificationPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const deleteVerification = trpc.deleteVerification.mutation(
  ({ input }) => {
    const verification = db.verification.findFirst({
      where: { id: { equals: input.id } },
    });

    if (!verification) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Verification not found',
      });
    }

    // Delete the verification record
    db.verification.delete({
      where: { id: { equals: input.id } },
    });

    const result: DeleteVerificationPayload = {
      deletedID: verification.id,
    };

    return result;
  },
);
