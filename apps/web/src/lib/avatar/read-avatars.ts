import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '../auth/require-auth';
import { avatarClient } from '../rpc/clients/avatar-client';

/**
 * Reads the caller's avatars for the roster; the standalone route guards its own auth since it sits
 * outside the shell.
 */
export const readAvatars = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAuth();

  return avatarClient.getAvatars({});
});
