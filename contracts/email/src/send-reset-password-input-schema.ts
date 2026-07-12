import * as z from 'zod';

export const SendResetPasswordInputSchema = z.object({ resetURL: z.url(), to: z.email() });

export type SendResetPasswordInput = z.infer<typeof SendResetPasswordInputSchema>;
