import * as z from 'zod';

/**
 * `email` is the address someone tried to sign up with; `to` is where the notice is delivered —
 * the same address for a self-service signup, but kept distinct so the template can name the
 * colliding address regardless of who ends up receiving the notice.
 */
export const SendExistingAccountInputSchema = z.object({
  email: z.email(),
  to: z.email(),
});

export type SendExistingAccountInput = z.infer<typeof SendExistingAccountInputSchema>;
