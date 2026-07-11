import { UserEmailSchema } from '@vers/contract-user';
import * as z from 'zod';

export const ChangeEmailFormSchema = z.object({ email: UserEmailSchema });

export type ChangeEmailFormInput = z.infer<typeof ChangeEmailFormSchema>;
