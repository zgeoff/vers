import { createFileRoute, redirect } from '@tanstack/react-router';
import { AetherCurrentPanel } from '../-aether-current/aether-current-panel';
import { avatarClient } from '../../lib/rpc/clients/avatar-client';

export const Route = createFileRoute('/_game/aether_/current')({
  component: AetherCurrentPanel,
  head: () => ({ meta: [{ title: 'vers | Aether Node' }] }),
  loader: async () => {
    const [avatar] = await avatarClient.getAvatars({});

    if (avatar === undefined) {
      throw redirect({ href: '/avatar/create' });
    }
  },
});
