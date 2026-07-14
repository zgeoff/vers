import { expect, test } from 'bun:test';
import { setOfflineCapStatus } from './set-offline-cap-status';
import { useOfflineCapStatusStore } from './use-offline-cap-status-store';

test('it replaces the stored cap status wholesale', () => {
  setOfflineCapStatus({ halted: false, remainingMs: 30_000 });

  expect(useOfflineCapStatusStore.getState().offlineCapStatus).toStrictEqual({
    halted: false,
    remainingMs: 30_000,
  });

  setOfflineCapStatus({ halted: true, remainingMs: 0 });

  expect(useOfflineCapStatusStore.getState().offlineCapStatus).toStrictEqual({
    halted: true,
    remainingMs: 0,
  });
});
