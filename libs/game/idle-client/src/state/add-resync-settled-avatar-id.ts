import { useIdleStore } from './use-idle-store';

export function addResyncSettledAvatarID(avatarID: string) {
  useIdleStore.setState((state) =>
    state.resyncSettledAvatarIDs.includes(avatarID)
      ? state
      : { resyncSettledAvatarIDs: [...state.resyncSettledAvatarIDs, avatarID] },
  );
}
