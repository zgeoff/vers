import { NameSchema, UsernameSchema } from '@vers/contract-user';
import * as z from 'zod';
import { ConfirmPasswordSchema } from '../../lib/validation/confirm-password-schema';

export const OnboardingFormSchema = z
  .object({
    agreeToTerms: z.literal(true, {
      error: 'You must agree to the terms of service and privacy policy',
    }),
    name: NameSchema,
    rememberMe: z.boolean(),
    username: UsernameSchema,
  })
  .and(ConfirmPasswordSchema);

export type OnboardingFormInput = z.infer<typeof OnboardingFormSchema>;
