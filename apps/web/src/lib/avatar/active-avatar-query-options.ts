import { orpc } from '../rpc/orpc';
import { findActiveAvatar } from './find-active-avatar';

export function activeAvatarQueryOptions() {
  return orpc.avatar.getAvatars.queryOptions({
    input: {},
    select: findActiveAvatar,
  });
}
