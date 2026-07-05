import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { UpdateEmailPayload } from '@vers/service-types';
import { UserEmailSchema } from '@vers/validation';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '~/logger';
import { t } from '../t';
import type { Context } from '../types';

export const UpdateEmailInputSchema = z.object({
  email: UserEmailSchema,
  id: z.string(),
});

export async function updateEmail(
  input: z.infer<typeof UpdateEmailInputSchema>,
  ctx: Context,
): Promise<UpdateEmailPayload> {
  try {
    const { email, id } = input;

    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const updatedID = await ctx.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          email,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, id))
        .returning({ updatedID: schema.users.id });

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const twoFactorTypeCondition = or(
        eq(schema.verifications.type, '2fa'),
        eq(schema.verifications.type, '2fa-setup'),
      );

      const twoFactorAuth = await tx.query.verifications.findFirst({
        where: and(eq(schema.verifications.target, user.email), twoFactorTypeCondition),
      });

      // if we have 2FA enabled or setup in progress, we need to update the
      // verification target to the new email
      if (twoFactorAuth) {
        await tx
          .update(schema.verifications)
          .set({ target: email })
          .where(eq(schema.verifications.id, twoFactorAuth.id));
      }

      return updated.updatedID;
    });

    return { updatedID };
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
  .input(UpdateEmailInputSchema)
  .mutation((opts) => updateEmail(opts.input, opts.ctx));
