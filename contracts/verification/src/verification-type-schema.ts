import * as z from 'zod';

export const VerificationTypeSchema = z.enum(['2fa', '2fa-setup', 'change-email', 'onboarding']);

export type VerificationType = z.infer<typeof VerificationTypeSchema>;
