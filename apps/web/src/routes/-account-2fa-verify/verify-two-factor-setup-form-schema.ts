import * as z from 'zod';

export const VerifyTwoFactorSetupFormSchema = z.object({
  code: z.string().length(6, 'Invalid code'),
  target: z.string().min(1),
});

export type VerifyTwoFactorSetupFormInput = z.infer<typeof VerifyTwoFactorSetupFormSchema>;
