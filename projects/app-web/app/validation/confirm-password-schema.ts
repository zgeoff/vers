import { PasswordSchema } from '@vers/validation';
import { z } from 'zod';

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
