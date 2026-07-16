import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { activityClient } from './clients/activity-client';
import { avatarClient } from './clients/avatar-client';
import { sessionClient } from './clients/session-client';
import { userClient } from './clients/user-client';
import { verificationClient } from './clients/verification-client';
import type { DeepReadonly } from './types';

export const orpc = {
  activity: createTanstackQueryUtils(activityClient),
  avatar: createTanstackQueryUtils(avatarClient),
  session: createTanstackQueryUtils(sessionClient),
  user: createTanstackQueryUtils(userClient),
  verification: createTanstackQueryUtils(verificationClient),
};

export type OrpcQueryUtils = DeepReadonly<typeof orpc>;
