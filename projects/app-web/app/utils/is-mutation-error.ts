import type { MutationErrorPayload } from '../gql/graphql';

export function isMutationError(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  payload?: MutationErrorPayload | object,
): payload is MutationErrorPayload {
  return payload !== undefined && 'error' in payload;
}
