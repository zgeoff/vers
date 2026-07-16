import { useIdleStore } from './use-idle-store';

export function setConnectionStatus(connectionOnline: boolean) {
  useIdleStore.setState(() => ({ connectionOnline }));
}
