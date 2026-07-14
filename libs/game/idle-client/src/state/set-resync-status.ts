import type { ResyncStatus } from '../types';
import { useIdleStore } from './use-idle-store';

export function setResyncStatus(resyncStatus: null | ResyncStatus) {
  useIdleStore.setState(() => ({ resyncStatus }));
}
