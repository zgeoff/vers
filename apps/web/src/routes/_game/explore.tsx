import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ExplorePanel } from '../-explore/explore-panel';
import { requireActiveAvatar } from '../../lib/avatar/require-active-avatar';

export const Route = createFileRoute('/_game/explore')({
  component: ExplorePage,
  head: () => ({ meta: [{ title: 'vers | Explore' }] }),
  loader: () => requireActiveAvatar(),
  staticData: { presentation: 'focus', scene: 'worldmap' },
});

function ExplorePage() {
  return (
    <>
      <ExplorePanel />
      <Outlet />
    </>
  );
}
