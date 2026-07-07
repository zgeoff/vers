import { PasswordSchema, UserEmailSchema } from '@vers/contract-user';
import * as z from 'zod';

export const LoginFormSchema = z.object({
  email: UserEmailSchema,
  password: PasswordSchema,
  redirectTo: z.string().optional(),
  rememberMe: z.boolean(),
});

export type LoginFormInput = z.infer<typeof LoginFormSchema>;
