import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { avatarClient, sessionClient, userClient, verificationClient } from './clients';

/**
 * TanStack Query bindings for every service's oRPC client, namespaced by service and exposed
 * through the router context so any route can build query options off the real contract shape.
 */
export const orpc = {
  avatar: createTanstackQueryUtils(avatarClient),
  session: createTanstackQueryUtils(sessionClient),
  user: createTanstackQueryUtils(userClient),
  verification: createTanstackQueryUtils(verificationClient),
};

export type OrpcQueryUtils = typeof orpc;
