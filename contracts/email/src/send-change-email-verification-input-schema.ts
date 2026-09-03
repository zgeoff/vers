import * as z from 'zod';

export const SendChangeEmailVerificationInputSchema = z.object({
  newEmail: z.email(),
  to: z.email(),
  verificationCode: z.string(),
  verificationURL: z.url(),
});

export type SendChangeEmailVerificationInput = z.infer<
  typeof SendChangeEmailVerificationInputSchema
>;
