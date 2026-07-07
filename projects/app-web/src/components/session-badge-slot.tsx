import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CompositeComponent } from '@tanstack/react-start/rsc';
import { sessionBadgeQueryOptions } from '../lib/session/session-badge-query-options';

/**
 * The client-owned slot for the session-badge fragment: Query caches the server-rendered
 * Composite Component source and this component fills its one client slot with a refresh control.
 */
export function SessionBadgeSlot() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(sessionBadgeQueryOptions);

  const refresh = () => {
    void queryClient.refetchQueries({ queryKey: sessionBadgeQueryOptions.queryKey });
  };

  return (
    <CompositeComponent src={data.src}>
      <button data-testid="session-badge-refresh" onClick={refresh} type="button">
        Refresh
      </button>
    </CompositeComponent>
  );
}
