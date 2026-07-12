import * as z from 'zod';

/**
 * `to` is the account's current, still-verified address; `newEmail` is the address it's changing
 * to and the one the code and link actually verify.
 */
export const SendChangeEmailVerificationInputSchema = z.object({
  newEmail: z.email(),
  to: z.email(),
  verificationCode: z.string(),
  verificationURL: z.url(),
});

export type SendChangeEmailVerificationInput = z.infer<
  typeof SendChangeEmailVerificationInputSchema
>;
