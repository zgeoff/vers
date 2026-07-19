import { createFileRoute } from '@tanstack/react-router';
import { ExploreCurrentPanel } from '../-explore-current/explore-current-panel';
import { requireActiveAvatar } from '../../lib/avatar/require-active-avatar';

export const Route = createFileRoute('/_game/explore_/current')({
  component: ExploreCurrentPage,
  head: () => ({ meta: [{ title: 'vers | World Map Encounter' }] }),
  loader: () => requireActiveAvatar(),
  staticData: { presentation: 'focus', scene: 'worldmap' },
});

function ExploreCurrentPage() {
  const ctx = Route.useRouteContext();

  return <ExploreCurrentPanel orpc={ctx.orpc} />;
}
