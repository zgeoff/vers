import { orpc } from '../rpc/orpc';

/**
 * The app's one active-avatar rule: the caller's first avatar, or none. The single place to
 * change it once an account can hold more than one.
 */
export function activeAvatarQueryOptions() {
  return orpc.avatar.getAvatars.queryOptions({
    input: {},
    select: (avatars) => avatars[0] ?? null,
  });
}
