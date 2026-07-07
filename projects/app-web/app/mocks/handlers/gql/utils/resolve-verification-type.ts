import { VerificationType } from '../../../../gql/graphql';

/** Mirrors the `verification_type` database enum. */
type DBVerificationType = '2fa' | '2fa-setup' | 'onboarding' | 'change-email';

/**
 * Maps GraphQL enum values to database enum values for verification types
 *
 * Mirrors our backend implementation.
 */
export function resolveVerificationType(type: VerificationType): DBVerificationType {
  return VERIFICATION_TYPE_MAP[type];
}

type VerificationTypeMap = Record<VerificationType, DBVerificationType>;

const VERIFICATION_TYPE_MAP: VerificationTypeMap = {
  [VerificationType.ChangeEmail]: '2fa',
  [VerificationType.ChangeEmailConfirmation]: 'change-email',
  [VerificationType.ChangePassword]: '2fa',
  [VerificationType.Onboarding]: 'onboarding',
  [VerificationType.ResetPassword]: '2fa',
  [VerificationType.TwoFactorAuth]: '2fa',
  [VerificationType.TwoFactorAuthDisable]: '2fa',
  [VerificationType.TwoFactorAuthSetup]: '2fa-setup',
} as const;
