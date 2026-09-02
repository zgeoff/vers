import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import invariant from 'tiny-invariant';
import { AvatarContent } from '../../routes/-avatar/avatar-content';
import { avatarClient } from '../rpc/clients/avatar-client';
import { findActiveAvatar } from './find-active-avatar';

export const getAvatarContent = createServerFn({ method: 'GET' }).handler(async () => {
  const roster = await avatarClient.getAvatars({});

  const avatar = findActiveAvatar(roster);

  invariant(avatar, 'a shell route loaded without an active avatar');

  const Renderable = await renderServerComponent(<AvatarContent avatar={avatar} />);

  return { Renderable };
});
