import { isDefinedError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import type { OrpcQueryUtils } from '../lib/rpc/orpc';

interface CurrentUserPanelProps {
  readonly orpc: OrpcQueryUtils;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @orpc/tanstack-query's query-utils shape nests anonymous mapped-object layers with mutable function-valued members; no named type and no deeply-readonly form the rule's allow list can match
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
