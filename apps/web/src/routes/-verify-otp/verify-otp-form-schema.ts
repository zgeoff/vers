import { VerificationTypeSchema } from '@vers/contract-verification';
import * as z from 'zod';

export const VerifyOTPFormSchema = z.object({
  code: z.string().length(6, 'Invalid code'),
  redirect: z.string().optional(),
  target: z.string().min(1),
  type: VerificationTypeSchema,
});

export type VerifyOTPFormInput = z.infer<typeof VerifyOTPFormSchema>;
