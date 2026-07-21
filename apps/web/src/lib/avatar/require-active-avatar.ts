import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

/**
 * The per-screen gate for avatar-dependent routes: a caller with no avatars goes to the create
 * sheet, one with avatars but no selection goes to the roster to pick, so the screen can assume
 * an active avatar exists.
 */
export const requireActiveAvatar = createServerFn({ method: 'GET' }).handler(async () => {
  const roster = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(roster);

  if (avatar === null) {
    throw redirect({ href: roster.avatars.length === 0 ? '/avatars/create' : '/avatars' });
  }

  return { avatar };
});
