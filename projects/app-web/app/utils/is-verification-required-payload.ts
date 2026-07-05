import type { VerificationRequiredPayload } from '~/gql/graphql';

export function isVerificationRequiredPayload(
  payload: object | VerificationRequiredPayload,
): payload is VerificationRequiredPayload {
  return 'transactionID' in payload;
}
