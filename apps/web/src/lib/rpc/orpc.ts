import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { activityClient } from './clients/activity-client';
import { avatarClient } from './clients/avatar-client';
import type { DeepReadonly } from './types';

export const orpc = {
  activity: createTanstackQueryUtils(activityClient),
  avatar: createTanstackQueryUtils(avatarClient),
};

export type OrpcQueryUtils = DeepReadonly<typeof orpc>;
