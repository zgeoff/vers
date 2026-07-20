import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { findActiveAvatar } from '../avatar/find-active-avatar';
import { activityClient } from '../rpc/clients/activity-client';
import { avatarClient } from '../rpc/clients/avatar-client';

/**
 * The per-screen gate for the engagement view: redirects a caller with no avatar to the create
 * sheet and a caller with no running activity back to explore, so the screen can assume a live
 * activity to render.
 */
export const requireActiveActivity = createServerFn({ method: 'GET' }).handler(async () => {
  const avatars = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(avatars);

  if (avatar === null) {
    throw redirect({ href: '/avatars/create' });
  }

  const activity = await activityClient.getCurrentActivity({ avatarID: avatar.id });

  if (activity === null) {
    throw redirect({ href: '/explore' });
  }

  return { activity, avatar };
});
