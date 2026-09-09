import { expect, test } from 'bun:test';
import { setStoragePersistence } from './set-storage-persistence';
import { useIdleStore } from './use-idle-store';

test('it records the persistence outcome the browser answered', () => {
  setStoragePersistence('denied');

  expect(useIdleStore.getState().storagePersistence).toBe('denied');
});
