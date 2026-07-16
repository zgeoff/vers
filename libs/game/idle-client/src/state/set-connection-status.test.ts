import { expect, test } from 'bun:test';
import { setConnectionStatus } from './set-connection-status';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored connection status wholesale', () => {
  setConnectionStatus(false);
  expect(useIdleStore.getState().connectionOnline).toBeFalse();
  setConnectionStatus(true);
  expect(useIdleStore.getState().connectionOnline).toBeTrue();
});
