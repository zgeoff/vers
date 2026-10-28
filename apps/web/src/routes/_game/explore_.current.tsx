import { createFileRoute } from '@tanstack/react-router';
import { ExploreCurrentPanel } from '../-explore-current/explore-current-panel';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/explore_/current')({
  component: ExploreCurrentPage,
  head: () => ({ meta: [{ title: 'vers | World Map Encounter' }] }),
  loader: (opts) => requireActiveAvatarOrLastKnown(opts.context.queryClient),
  staticData: { presentation: 'focus', scene: 'worldmap' },
});

function ExploreCurrentPage() {
  const ctx = Route.useRouteContext();

  return <ExploreCurrentPanel orpc={ctx.orpc} />;
}
