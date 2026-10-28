import type { QueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { LAST_KNOWN_QUERY_KEY_PREFIX } from './last-known-query-key-prefix';
import { NetworkFailureError } from './network-failure-error';

type LastKnownName =
  | 'account-content'
  | 'active-avatar'
  | 'auth'
  | 'avatar-content'
  | 'avatar-roster'
  | 'flags'
  | 'qa-debug-hook';

export async function readWithLastKnown<T>(
  queryClient: QueryClient,
  name: LastKnownName,
  read: () => Promise<T>,
): Promise<T> {
  const options = queryOptions({
    queryFn: read,
    queryKey: [LAST_KNOWN_QUERY_KEY_PREFIX, name],
    staleTime: 0,

    // a server component in the value fails Query's default deep-equality check
    structuralSharing: false,
  });

  try {
    return await queryClient.query(options);
  } catch (error) {
    if (!(error instanceof NetworkFailureError)) {
      throw error;
    }

    const lastKnown = queryClient.getQueryData(options.queryKey);

    if (lastKnown === undefined) {
      throw error;
    }

    return lastKnown;
  }
}
