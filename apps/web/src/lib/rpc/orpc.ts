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

type DeepReadonly<T> = T extends (...args: ReadonlyArray<never>) => unknown
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

export type OrpcQueryUtils = DeepReadonly<typeof orpc>;
