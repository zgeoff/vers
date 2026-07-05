import type { MutationErrorPayload } from '../gql/graphql';

export function isMutationError(
  payload?: MutationErrorPayload | object,
): payload is MutationErrorPayload {
  return payload !== undefined && 'error' in payload;
}
