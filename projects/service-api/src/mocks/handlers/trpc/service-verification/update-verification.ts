import type { UpdateVerificationPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import { omitNullish } from '~/utils/omit-nullish';
import { db } from '../../../db';
import { trpc } from './trpc';

export const updateVerification = trpc.updateVerification.mutation(
  ({ input }) => {
    const { id, ...update } = input;

    const verification = db.verification.findFirst({
      where: { id: { equals: id } },
    });

    if (!verification) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Verification not found',
      });
    }

    const updatedVerification = db.verification.update({
      data: omitNullish(update),
      where: { id: { equals: id } },
    });

    if (!updatedVerification) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update verification',
      });
    }

    const result: UpdateVerificationPayload = {
      updatedID: updatedVerification.id,
    };

    return result;
  },
);
