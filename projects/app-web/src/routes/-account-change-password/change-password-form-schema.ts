import { PasswordSchema } from '@vers/contract-user';
import * as z from 'zod';
import { ConfirmPasswordSchema } from '../../lib/validation/confirm-password-schema';

export const ChangePasswordFormSchema = z
  .object({ currentPassword: PasswordSchema })
  .and(ConfirmPasswordSchema);

export type ChangePasswordFormInput = z.infer<typeof ChangePasswordFormSchema>;
