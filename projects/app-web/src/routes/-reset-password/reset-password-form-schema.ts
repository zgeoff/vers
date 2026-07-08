import * as z from 'zod';
import { ConfirmPasswordSchema } from '../../lib/validation/confirm-password-schema';

export const ResetPasswordFormSchema = z
  .object({ email: z.string(), resetToken: z.string() })
  .and(ConfirmPasswordSchema);

export type ResetPasswordFormInput = z.infer<typeof ResetPasswordFormSchema>;
