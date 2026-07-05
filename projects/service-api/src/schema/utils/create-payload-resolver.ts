import { MutationErrorPayload } from '../types/mutation-error-payload';
import { VerificationRequiredPayload } from '../types/verification-required-payload';

export function createPayloadResolver<T>(
  type: T,
): (value: object) => T | typeof MutationErrorPayload | typeof VerificationRequiredPayload {
  return (value) => {
    if ('error' in value) {
      return MutationErrorPayload;
    }

    if ('transactionID' in value) {
      return VerificationRequiredPayload;
    }

    return type;
  };
}
