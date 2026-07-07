import { UserEmailSchema } from '@vers/contract-user';
import * as z from 'zod';

export const SignupFormSchema = z.object({ email: UserEmailSchema });

export type SignupFormInput = z.infer<typeof SignupFormSchema>;
