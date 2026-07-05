import type { verifications } from '@vers/postgres-schema';
import { VerificationType } from '../types/verification-type';

/**
 * @description Maps GraphQL enum values to database enum values for verification types
 * @remarks Ensures consistent mapping between GraphQL and database enums
 */
export function resolveVerificationType(
  type: VerificationType,
): (typeof verifications.type.enumValues)[number] {
  return VERIFICATION_TYPE_MAP[type];
}

type VerificationTypeMap = Record<VerificationType, (typeof verifications.type.enumValues)[number]>;

/**
 * @description Maps GraphQL enum values to database enum values for verification types.
 * @remarks This is used to ensure consistent mapping between GraphQL and database enums.
 */
const VERIFICATION_TYPE_MAP: VerificationTypeMap = {
  [VerificationType.CHANGE_EMAIL]: '2fa',
  [VerificationType.CHANGE_EMAIL_CONFIRMATION]: 'change-email',
  [VerificationType.CHANGE_PASSWORD]: '2fa',
  [VerificationType.ONBOARDING]: 'onboarding',
  [VerificationType.RESET_PASSWORD]: '2fa',
  [VerificationType.TWO_FACTOR_AUTH]: '2fa',
  [VerificationType.TWO_FACTOR_AUTH_DISABLE]: '2fa',
  [VerificationType.TWO_FACTOR_AUTH_SETUP]: '2fa-setup',
} as const;
