import { Collection } from '@msw/data';
import { UserDataSchema } from '@vers/contract-user';
import * as z from 'zod';

/**
 * A stored mock user row: the public `UserDataSchema` plus the mock backend's own password check
 * and its password-reset token state.
 */
export const UserRowSchema = UserDataSchema.extend({
  password: z.string(),
  passwordResetToken: z.string().nullable().default(null),
  passwordResetTokenExpiresAt: z.date().nullable().default(null),
});

export const userCollection = new Collection({ schema: UserRowSchema });
