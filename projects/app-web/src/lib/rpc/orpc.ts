import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { avatarClient } from './clients/avatar-client';
import { sessionClient } from './clients/session-client';
import { userClient } from './clients/user-client';
import { verificationClient } from './clients/verification-client';

export const orpc = {
  avatar: createTanstackQueryUtils(avatarClient),
  session: createTanstackQueryUtils(sessionClient),
  user: createTanstackQueryUtils(userClient),
  verification: createTanstackQueryUtils(verificationClient),
};

export type OrpcQueryUtils = typeof orpc;
