import type { verifications } from '@vers/postgres-schema';
import { VerificationType } from '~/gql/graphql';

/**
 * Maps GraphQL enum values to database enum values for verification types
 *
 * Mirrors our backend implementation.
 */
export function resolveVerificationType(
  type: VerificationType,
): (typeof verifications.type.enumValues)[number] {
  return VERIFICATION_TYPE_MAP[type];
}

type VerificationTypeMap = Record<VerificationType, (typeof verifications.type.enumValues)[number]>;

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
