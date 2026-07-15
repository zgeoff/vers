import { createFileRoute, redirect } from '@tanstack/react-router';
import { ExploreCurrentPanel } from '../-explore-current/explore-current-panel';
import { findActiveAvatar } from '../../lib/avatar/find-active-avatar';
import { avatarClient } from '../../lib/rpc/clients/avatar-client';

export const Route = createFileRoute('/_game/explore_/current')({
  component: ExploreCurrentPanel,
  head: () => ({ meta: [{ title: 'vers | World Map Encounter' }] }),
  loader: async () => {
    const avatars = await avatarClient.getAvatars({});

    const avatar = findActiveAvatar(avatars);

    if (avatar === null) {
      throw redirect({ href: '/avatar/create' });
    }
  },
  staticData: { presentation: 'focus', scene: 'worldmap' },
});
