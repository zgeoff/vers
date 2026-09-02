import * as z from 'zod';

export const SendPasswordChangedInputSchema = z.object({ email: z.email(), to: z.email() });

export type SendPasswordChangedInput = z.infer<typeof SendPasswordChangedInputSchema>;
