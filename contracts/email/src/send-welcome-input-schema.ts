import * as z from 'zod';

export const SendWelcomeInputSchema = z.object({
  to: z.email(),
  verificationCode: z.string(),
  verificationURL: z.url(),
});

export type SendWelcomeInput = z.infer<typeof SendWelcomeInputSchema>;
