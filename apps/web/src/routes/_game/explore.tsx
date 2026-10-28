import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ExplorePanel } from '../-explore/explore-panel';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/explore')({
  component: ExplorePage,
  head: () => ({ meta: [{ title: 'vers | Explore' }] }),
  loader: (opts) => requireActiveAvatarOrLastKnown(opts.context.queryClient),
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
