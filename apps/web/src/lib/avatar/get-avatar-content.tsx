import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { AvatarContent } from '../../routes/-avatar/avatar-content';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

/**
 * Runs fresh on every loader pass (no client-side cache layer of its own).
 */
export const getAvatarContent = createServerFn({ method: 'GET' }).handler(async () => {
  const avatars = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(avatars);

  if (avatar === null) {
    throw redirect({ href: '/avatar/create' });
  }

  const Renderable = await renderServerComponent(<AvatarContent avatar={avatar} />);

  return { Renderable };
});
