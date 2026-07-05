import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { GetUserPayload } from '@vers/service-types';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '~/logger';
import { t } from '../t';
import type { Context } from '../types';

export const GetUserInputSchema = z
  .object({
    email: z.string().email().optional(),
    id: z.string().optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.id), {
    message: 'Either email or ID must be provided',
  });

export async function getUser(
  input: z.infer<typeof GetUserInputSchema>,
  ctx: Context,
): Promise<GetUserPayload> {
  try {
    const where = [
      input.email ? eq(schema.users.email, input.email) : undefined,
      input.id ? eq(schema.users.id, input.id) : undefined,
    ].filter(Boolean);

    const user = await ctx.db.query.users.findFirst({
      where: or(...where),
    });

    return user ?? null;
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
  .input(GetUserInputSchema)
  .query((opts) => getUser(opts.input, opts.ctx));
