import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ExplorePanel } from '../-explore/explore-panel';

export const Route = createFileRoute('/_game/explore')({
  component: ExplorePage,
  head: () => ({ meta: [{ title: 'vers | Explore' }] }),
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
