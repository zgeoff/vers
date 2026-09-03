import * as z from 'zod';
import { VerificationTypeSchema } from './verification-type-schema';

export const VerificationDataSchema = z.object({
  id: z.string(),
  target: z.string(),
  type: VerificationTypeSchema,
});

export type VerificationData = z.infer<typeof VerificationDataSchema>;
