import type { VerificationRequiredPayload } from '../gql/graphql';

export function isVerificationRequiredPayload(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  payload: object | VerificationRequiredPayload,
): payload is VerificationRequiredPayload {
  return 'transactionID' in payload;
}
