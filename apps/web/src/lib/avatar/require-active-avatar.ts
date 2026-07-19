import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

/**
 * The per-screen gate for avatar-dependent routes: redirects a caller with no avatar to the create
 * sheet, so the screen can assume an active avatar exists.
 */
export const requireActiveAvatar = createServerFn({ method: 'GET' }).handler(async () => {
  const avatars = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(avatars);

  if (avatar === null) {
    throw redirect({ href: '/avatars/create' });
  }

  return { avatar };
});
