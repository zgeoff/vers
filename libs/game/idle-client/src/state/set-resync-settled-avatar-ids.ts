import { useIdleStore } from './use-idle-store';

export function setResyncSettledAvatarIDs(resyncSettledAvatarIDs: ReadonlyArray<string>) {
  useIdleStore.setState(() => ({ resyncSettledAvatarIDs }));
}
