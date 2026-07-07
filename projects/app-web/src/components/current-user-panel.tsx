import { isDefinedError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import type { OrpcQueryUtils } from '../lib/rpc/query-utils';

/**
 * The client-lane counterpart to the index route's server-rendered auth state: the same
 * `getCurrentUser` procedure, read through the isomorphic `RPCLink` + TanStack Query instead of a
 * server function, proving the client lane's plumbing end to end.
 */
interface CurrentUserPanelProps {
  readonly orpc: OrpcQueryUtils;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @orpc/tanstack-query's generated query-utils shape carries its own function-valued members; no deeply-readonly form exists
export function CurrentUserPanel(props: CurrentUserPanelProps) {
  const query = useQuery(props.orpc.user.getCurrentUser.queryOptions({ input: {}, retry: false }));

  if (query.isPending) {
    return <p data-testid="current-user-panel-loading">Loading session…</p>;
  }

  if (query.error) {
    const reason = isDefinedError(query.error) ? query.error.data.reason : 'transport-error';

    return <p data-testid="current-user-panel-error">Client-lane read: signed out ({reason}).</p>;
  }

  return (
    <p data-testid="current-user-panel-data">Client-lane read: signed in as {query.data.name}.</p>
  );
}
