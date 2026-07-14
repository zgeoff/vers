import { expect, test } from 'bun:test';
import { setResyncStatus } from './set-resync-status';
import { useResyncStatusStore } from './use-resync-status-store';

test('it replaces the stored resync status wholesale, including clearing it', () => {
  setResyncStatus({ attempts: 3, kind: 'fast-forwarding', levelUps: 1 });

  expect(useResyncStatusStore.getState().resyncStatus).toStrictEqual({
    attempts: 3,
    kind: 'fast-forwarding',
    levelUps: 1,
  });

  setResyncStatus(null);
  expect(useResyncStatusStore.getState().resyncStatus).toBeNull();
});
