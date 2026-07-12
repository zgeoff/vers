import { createFileRoute, redirect } from '@tanstack/react-router';
import { ExploreCurrentPanel } from '../-explore-current/explore-current-panel';
import { avatarClient } from '../../lib/rpc/clients/avatar-client';

export const Route = createFileRoute('/_game/explore_/current')({
  component: ExploreCurrentPanel,
  head: () => ({ meta: [{ title: 'vers | World Map Encounter' }] }),
  loader: async () => {
    const [avatar] = await avatarClient.getAvatars({});

    if (avatar === undefined) {
      throw redirect({ href: '/avatar/create' });
    }
  },
  staticData: { presentation: 'focus', scene: 'worldmap' },
});
