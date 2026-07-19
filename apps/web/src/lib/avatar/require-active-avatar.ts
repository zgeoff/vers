import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

/**
 * The game shell's gate: redirects to the avatar roster when the caller has no avatar to play, so
 * every shell route can assume an active avatar exists.
 */
export const requireActiveAvatar = createServerFn({ method: 'GET' }).handler(async () => {
  const avatars = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(avatars);

  if (avatar === null) {
    throw redirect({ href: '/avatars' });
  }

  return { avatar };
});
