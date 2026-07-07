import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { avatarClient, sessionClient, userClient, verificationClient } from './clients';

export const orpc = {
  avatar: createTanstackQueryUtils(avatarClient),
  session: createTanstackQueryUtils(sessionClient),
  user: createTanstackQueryUtils(userClient),
  verification: createTanstackQueryUtils(verificationClient),
};

export type OrpcQueryUtils = typeof orpc;
