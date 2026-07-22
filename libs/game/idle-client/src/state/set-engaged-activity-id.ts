import { useIdleStore } from './use-idle-store';

export function setEngagedActivityID(engagedActivityID: null | string) {
  useIdleStore.setState(() => ({ engagedActivityID }));
}
