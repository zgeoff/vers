import { createId } from '@paralleldrive/cuid2';
import { TRPCError } from '@trpc/server';
import { createSeed } from '@vers/game-utils';
import * as schema from '@vers/postgres-schema';
import type { CreateUserPayload } from '@vers/service-types';
import { hashPassword, isPGError, isUniqueConstraintError } from '@vers/service-utils';
import { NameSchema, PasswordSchema, UserEmailSchema, UsernameSchema } from '@vers/validation';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

const CreateUserInputSchema = z.object({
  email: UserEmailSchema,
  name: NameSchema,
  password: PasswordSchema,
  username: UsernameSchema,
});

async function createUser(
  input: z.infer<typeof CreateUserInputSchema>,
  ctx: Context,
): Promise<CreateUserPayload> {
  try {
    const { email, name, password, username } = input;

    const createdAt = new Date();

    const passwordHash = await hashPassword(password);

    const user: typeof schema.users.$inferSelect = {
      createdAt,
      email,
      id: createId(),
      name,
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      seed: createSeed(),
      updatedAt: createdAt,
      username,
    };

    await ctx.db.insert(schema.users).values(user);

    return {
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      seed: user.seed,
      updatedAt: user.updatedAt,
      username: user.username,
    };
  } catch (error: unknown) {
    logger.error(error);

    if (isPGError(error)) {
      if (isUniqueConstraintError(error, 'users_email_unique')) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A user with that email already exists',
        });
      }

      if (isUniqueConstraintError(error, 'users_username_unique')) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A user with that username already exists',
        });
      }
    }

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
  .input(CreateUserInputSchema)
  .mutation((opts) => createUser(opts.input, opts.ctx));
