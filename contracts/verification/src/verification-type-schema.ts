import * as z from 'zod';

/**
 * What a verification code is gating: 2FA login/setup, an email change, or onboarding.
 */
export const VerificationTypeSchema = z.enum(['2fa', '2fa-setup', 'change-email', 'onboarding']);

export type VerificationType = z.infer<typeof VerificationTypeSchema>;
