import * as z from 'zod';

/**
 * A step-up-gated action; the pending-transaction and transaction-token subject.
 */
export const SecureActionSchema = z.enum([
  'ChangeEmail',
  'ChangeEmailConfirmation',
  'ChangePassword',
  'ForceLogout',
  'Onboarding',
  'ResetPassword',
  'TwoFactorAuth',
  'TwoFactorAuthDisable',
  'TwoFactorAuthSetup',
]);

export type SecureAction = z.infer<typeof SecureActionSchema>;
