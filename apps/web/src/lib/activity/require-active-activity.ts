import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { withRequiredSession } from '../auth/with-required-session';
import { findActiveAvatar } from '../avatar/find-active-avatar';
import { activityClient } from '../rpc/clients/activity-client';
import { avatarClient } from '../rpc/clients/avatar-client';

export const requireActiveActivity = createServerFn({ method: 'GET' }).handler(() =>
  withRequiredSession(async () => {
    const roster = await avatarClient.getAvatars({});

    const avatar = findActiveAvatar(roster);

    if (avatar === null) {
      throw redirect({ href: roster.avatars.length === 0 ? '/avatars/create' : '/avatars' });
    }

    const activity = await activityClient.getCurrentActivity({ avatarID: avatar.id });

    if (activity === null) {
      throw redirect({ href: '/explore' });
    }

    return { activity, avatar };
  }),
);
