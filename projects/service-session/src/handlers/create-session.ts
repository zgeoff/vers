import { createId } from '@paralleldrive/cuid2';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { CreateSessionPayload } from '@vers/service-types';
import { z } from 'zod';
import * as consts from '../consts';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const CreateSessionInputSchema = z.object({
  expiresAt: z.date().optional(),
  ipAddress: z.string(),
  rememberMe: z.boolean().optional(),
  userID: z.string(),
});

export async function createSession(
  input: z.infer<typeof CreateSessionInputSchema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<CreateSessionPayload> {
  try {
    const { expiresAt, ipAddress, rememberMe, userID } = input;

    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    const sessionDuration = rememberMe
      ? consts.SESSION_DURATION_LONG
      : consts.SESSION_DURATION_SHORT;

    const sessionExpiresAt = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + sessionDuration);

    const session = {
      createdAt: new Date(),
      expiresAt: sessionExpiresAt,
      id: createId(),
      ipAddress,
      updatedAt: new Date(),
      userID,
      verified: false,
    } satisfies typeof schema.sessions.$inferInsert;

    await ctx.db.insert(schema.sessions).values(session);

    return session;
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
  .input(CreateSessionInputSchema)
  .mutation((opts) => createSession(opts.input, opts.ctx));
