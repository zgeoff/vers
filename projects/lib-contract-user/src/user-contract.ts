import { authedRoute, defineErrors, publicRoute } from '@vers/contract-base';
import * as z from 'zod';
import { NameSchema } from './name-schema';
import { PasswordSchema } from './password-schema';
import { UserDataSchema } from './user-data-schema';
import { UserEmailSchema } from './user-email-schema';
import { UsernameSchema } from './username-schema';

const CreateUserConflictDataSchema = z.object({ field: z.enum(['email', 'username']) });
const UpdateEmailConflictDataSchema = z.object({ field: z.literal('email') });
const UpdateUserConflictDataSchema = z.object({ field: z.literal('username') });

/**
 * The user service's API: signup, credential checks, and profile mutation.
 */
export const userContract = {
  changePassword: authedRoute
    .route({ method: 'POST', path: '/users/me/password', summary: "Change the caller's password" })
    .input(z.object({ password: PasswordSchema }))
    .output(z.object({ updatedID: z.string() }))
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'User not found' },
      }),
    ),

  createPasswordResetToken: publicRoute
    .route({
      method: 'POST',
      path: '/users/password-reset-token',
      summary: 'Mint a password-reset token for a user',
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ resetToken: z.string() }))
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'User not found' },
        PASSWORD_NOT_SET: {
          data: z.object({}),
          message: 'User has no password set',
          status: 409,
        },
      }),
    ),

  createUser: publicRoute
    .route({ method: 'POST', path: '/users', summary: 'Create a user' })
    .input(
      z.object({
        email: UserEmailSchema,
        name: NameSchema,
        password: PasswordSchema,
        username: UsernameSchema,
      }),
    )
    .output(UserDataSchema)
    .errors(
      defineErrors({
        CONFLICT: {
          data: CreateUserConflictDataSchema,
          message: 'A user with that email or username already exists',
        },
      }),
    ),

  getCurrentUser: authedRoute
    .route({ method: 'GET', path: '/users/me', summary: 'Get the currently authenticated user' })
    .input(z.object({}))
    .output(UserDataSchema),

  getUser: publicRoute
    .route({ method: 'GET', path: '/users', summary: 'Look up a user by id or email' })
    .input(z.object({ email: z.string().optional(), id: z.string().optional() }))
    .output(UserDataSchema.nullable()),

  resetPassword: publicRoute
    .route({ method: 'POST', path: '/users/password-reset', summary: 'Reset a password by token' })
    .input(
      z.object({
        id: z.string(),
        password: PasswordSchema,
        resetToken: z.string(),
      }),
    )
    .output(z.object({}))
    .errors(
      defineErrors({
        INVALID_RESET_TOKEN: {
          data: z.object({}),
          message: 'Invalid reset token',
          status: 422,
        },
        NOT_FOUND: { data: z.object({}), message: 'User not found' },
        RESET_TOKEN_EXPIRED: {
          data: z.object({}),
          message: 'Reset token expired',
          status: 410,
        },
      }),
    ),

  updateEmail: authedRoute
    .route({ method: 'PATCH', path: '/users/me/email', summary: "Change the caller's email" })
    .input(z.object({ email: UserEmailSchema }))
    .output(z.object({ updatedID: z.string() }))
    .errors(
      defineErrors({
        CONFLICT: {
          data: UpdateEmailConflictDataSchema,
          message: 'A user with that email already exists',
        },
        NOT_FOUND: { data: z.object({}), message: 'User not found' },
      }),
    ),

  updateUser: authedRoute
    .route({ method: 'PATCH', path: '/users/me', summary: "Update the caller's profile" })
    .input(z.object({ name: NameSchema.optional(), username: UsernameSchema.optional() }))
    .output(z.object({ updatedID: z.string() }))
    .errors(
      defineErrors({
        CONFLICT: {
          data: UpdateUserConflictDataSchema,
          message: 'A user with that username already exists',
        },
        NOT_FOUND: { data: z.object({}), message: 'User not found' },
      }),
    ),

  verifyPassword: publicRoute
    .route({ method: 'POST', path: '/users/verify-password', summary: "Check a user's password" })
    .input(z.object({ email: z.string(), password: z.string() }))
    .output(z.object({ success: z.boolean() })),
};

export type UserContract = typeof userContract;
