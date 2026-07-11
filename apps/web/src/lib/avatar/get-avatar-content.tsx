import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { AvatarContent } from '../../routes/-avatar/avatar-content';
import { avatarClient } from '../rpc/clients/avatar-client';

/**
 * Runs fresh on every loader pass (no client-side cache layer of its own).
 */
export const getAvatarContent = createServerFn({ method: 'GET' }).handler(async () => {
  const [avatar] = await avatarClient.getAvatars({});

  if (avatar === undefined) {
    throw redirect({ href: '/avatar/create' });
  }

  const Renderable = await renderServerComponent(<AvatarContent avatar={avatar} />);

  return { Renderable };
});
