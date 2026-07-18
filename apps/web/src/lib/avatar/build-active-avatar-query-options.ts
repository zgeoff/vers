import { orpc } from '../rpc/orpc';
import { findActiveAvatar } from './find-active-avatar';

export function buildActiveAvatarQueryOptions() {
  return orpc.avatar.getAvatars.queryOptions({
    input: {},
    select: findActiveAvatar,
  });
}
