import { setStoragePersistence } from '@vers/idle-client';

interface PersistentStorageManager {
  readonly persist: () => Promise<boolean>;
}

// `persist()` exists on Window only, never in a worker, so the tab asks at the player's start and
// the answer is recorded once; a browser without the API reads as best-effort storage
export async function syncStoragePersistence(
  storage: PersistentStorageManager | undefined = findStorageManager(),
): Promise<void> {
  if (storage === undefined) {
    setStoragePersistence('unavailable');

    return;
  }

  try {
    const granted = await storage.persist();

    const outcome = granted ? 'granted' : 'denied';

    setStoragePersistence(outcome);
  } catch {
    setStoragePersistence('unavailable');
  }
}

function findStorageManager(): PersistentStorageManager | undefined {
  const storage: PersistentStorageManager | undefined = globalThis.navigator?.storage;

  return typeof storage?.persist === 'function' ? storage : undefined;
}
