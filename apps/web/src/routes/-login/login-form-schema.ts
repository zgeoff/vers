import { PasswordSchema, UserEmailSchema } from '@vers/contract-user';
import * as z from 'zod';

export const LoginFormSchema = z.object({
  email: UserEmailSchema,
  password: PasswordSchema,
  redirectTo: z.string().optional(),
  rememberMe: z.boolean().default(false),
});

export type LoginFormInput = z.infer<typeof LoginFormSchema>;
