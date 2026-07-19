import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import invariant from 'tiny-invariant';
import { AvatarContent } from '../../routes/-avatar/avatar-content';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

/**
 * Runs fresh on every loader pass (no client-side cache layer of its own). The shell gate redirects
 * an avatarless caller to the roster before any shell route loads, so an active avatar is present.
 */
export const getAvatarContent = createServerFn({ method: 'GET' }).handler(async () => {
  const avatars = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(avatars);

  invariant(avatar, 'a shell route loaded without an active avatar');

  const Renderable = await renderServerComponent(<AvatarContent avatar={avatar} />);

  return { Renderable };
});
