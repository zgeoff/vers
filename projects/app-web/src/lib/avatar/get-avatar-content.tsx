import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { AvatarContent } from '../../routes/-avatar/avatar-content';
import { avatarClient } from '../rpc/clients/avatar-client';

/**
 * GET server function: reads the caller's first avatar and renders the avatar page's summary.
 * Redirects to avatar creation when the caller has none yet. Called fresh on every loader run (no
 * client-side cache layer of its own). Untestable end to end under `bun test`: the Flight pipeline
 * it calls into resolves to a client-build stub that unconditionally throws, since `bun test`
 * resolves package exports without the `react-server` condition.
 */
export const getAvatarContent = createServerFn({ method: 'GET' }).handler(async () => {
  const [avatar] = await avatarClient.getAvatars({});

  if (avatar === undefined) {
    throw redirect({ href: '/avatar/create' });
  }

  const Renderable = await renderServerComponent(<AvatarContent avatar={avatar} />);

  return { Renderable };
});
