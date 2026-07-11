import * as z from 'zod';

/**
 * `email` names the account whose password changed; `to` is where the notice is delivered — the
 * same address in practice, but kept distinct for the same reason as the existing-account
 * template.
 */
export const SendPasswordChangedInputSchema = z.object({ email: z.email(), to: z.email() });

export type SendPasswordChangedInput = z.infer<typeof SendPasswordChangedInputSchema>;
