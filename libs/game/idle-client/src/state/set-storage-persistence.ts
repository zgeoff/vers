import type { StoragePersistence } from '../types';
import { useIdleStore } from './use-idle-store';

export function setStoragePersistence(storagePersistence: StoragePersistence) {
  useIdleStore.setState(() => ({ storagePersistence }));
}
