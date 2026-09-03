import * as z from 'zod';

export const SendExistingAccountInputSchema = z.object({
  email: z.email(),
  to: z.email(),
});

export type SendExistingAccountInput = z.infer<typeof SendExistingAccountInputSchema>;
