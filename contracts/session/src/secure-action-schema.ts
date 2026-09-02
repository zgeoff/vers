import * as z from 'zod';

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
