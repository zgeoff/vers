import type { ResyncStatus } from '../types';
import { useResyncStatusStore } from './use-resync-status-store';

export function setResyncStatus(resyncStatus: null | ResyncStatus) {
  useResyncStatusStore.setState(() => ({ resyncStatus }));
}
