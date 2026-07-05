import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { VerifyPasswordPayload } from '@vers/service-types';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '~/logger';
import { t } from '../t';
import type { Context } from '../types';

export const VerifyPasswordInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function verifyPassword(
  input: z.infer<typeof VerifyPasswordInputSchema>,
  ctx: Context,
): Promise<VerifyPasswordPayload> {
  try {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.email, input.email),
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!user.passwordHash) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User does not have a password set',
      });
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isValid) {
      return { success: false };
    }

    return { success: true };
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
  .input(VerifyPasswordInputSchema)
  .mutation((opts) => verifyPassword(opts.input, opts.ctx));
