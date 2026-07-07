import { UserEmailSchema } from '@vers/contract-user';
import * as z from 'zod';

export const ForgotPasswordFormSchema = z.object({ email: UserEmailSchema });

export type ForgotPasswordFormInput = z.infer<typeof ForgotPasswordFormSchema>;
