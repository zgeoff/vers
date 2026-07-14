import { expect, test } from 'bun:test';
import { setOfflineCapStatus } from './set-offline-cap-status';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored cap status wholesale', () => {
  setOfflineCapStatus({ halted: false, remainingMs: 30_000 });

  expect(useIdleStore.getState().offlineCapStatus).toStrictEqual({
    halted: false,
    remainingMs: 30_000,
  });

  setOfflineCapStatus({ halted: true, remainingMs: 0 });

  expect(useIdleStore.getState().offlineCapStatus).toStrictEqual({
    halted: true,
    remainingMs: 0,
  });
});
