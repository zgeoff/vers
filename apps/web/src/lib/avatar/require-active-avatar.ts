import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

export const requireActiveAvatar = createServerFn({ method: 'GET' }).handler(async () => {
  const roster = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(roster);

  if (avatar === null) {
    throw redirect({ href: roster.avatars.length === 0 ? '/avatars/create' : '/avatars' });
  }

  return { avatar };
});
