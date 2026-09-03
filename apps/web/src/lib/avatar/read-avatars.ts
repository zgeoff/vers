import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '../auth/require-auth';
import { withRequiredSession } from '../auth/with-required-session';
import { avatarClient } from '../rpc/clients/avatar-client';

export const readAvatars = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAuth();

  return withRequiredSession(() => avatarClient.getAvatars({}));
});
