import * as z from 'zod';

/**
 * Despite the procedure's name, this is the signup onboarding OTP: `verificationCode` and
 * `verificationURL` are the welcome template's actual props.
 */
export const SendWelcomeInputSchema = z.object({
  to: z.email(),
  verificationCode: z.string(),
  verificationURL: z.url(),
});

export type SendWelcomeInput = z.infer<typeof SendWelcomeInputSchema>;
