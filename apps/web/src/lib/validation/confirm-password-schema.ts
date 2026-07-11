import { PasswordSchema } from '@vers/contract-user';
import * as z from 'zod';

/**
 * Shared shape for any form collecting a new password twice, requiring the pair to match.
 */
export const ConfirmPasswordSchema = z
  .object({ confirmPassword: PasswordSchema, password: PasswordSchema })
  .superRefine((value, ctx) => {
    if (value.confirmPassword !== value.password) {
      ctx.addIssue({
        code: 'custom',
        message: 'The passwords must match',
        path: ['confirmPassword'],
      });
    }
  });
