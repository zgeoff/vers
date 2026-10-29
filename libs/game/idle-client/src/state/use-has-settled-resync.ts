import { useIdleStore } from './use-idle-store';

export function useHasSettledResync(avatarID: string | undefined): boolean {
  return useIdleStore(
    (state) => avatarID !== undefined && state.resyncSettledAvatarIDs.includes(avatarID),
  );
}
