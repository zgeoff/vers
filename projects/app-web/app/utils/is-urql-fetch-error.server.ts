import type { CombinedError } from '@urql/core';
import { isURQLError } from './is-urql-error.server';

interface FetchError extends CombinedError {
  response: Response;
}

export function isURQLFetchError(error: unknown): error is FetchError {
  return isURQLError(error) && 'response' in error;
}
