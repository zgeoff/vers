import * as z from 'zod';
import { VerificationTypeSchema } from './verification-type-schema';

/**
 * A verification as returned to callers; strips the TOTP secret and its configuration.
 */
export const VerificationDataSchema = z.object({
  id: z.string(),
  target: z.string(),
  type: VerificationTypeSchema,
});

export type VerificationData = z.infer<typeof VerificationDataSchema>;
