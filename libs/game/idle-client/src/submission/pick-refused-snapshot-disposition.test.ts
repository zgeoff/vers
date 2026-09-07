import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createMockLatestActivityProgress } from '../test-utils/factories/create-mock-latest-activity-progress';
import { pickRefusedSnapshotDisposition } from './pick-refused-snapshot-disposition';

test('it defers while the named predecessor is still the server’s active row', () => {
  const predecessor = createMockActivityData({ status: 'active' });

  const disposition = pickRefusedSnapshotDisposition({
    latest: createMockLatestActivityProgress({ activity: predecessor }),
    predecessorID: predecessor.id,
  });

  expect(disposition).toBe('deferred');
});

test('it rejects once the named predecessor has left active play server-side', () => {
  const predecessor = createMockActivityData({ status: 'stopped' });

  const disposition = pickRefusedSnapshotDisposition({
    latest: createMockLatestActivityProgress({ activity: predecessor }),
    predecessorID: predecessor.id,
  });

  expect(disposition).toBe('rejected');
});

test('it rejects when the server’s active row is not the named predecessor', () => {
  const disposition = pickRefusedSnapshotDisposition({
    latest: createMockLatestActivityProgress({
      activity: createMockActivityData({ status: 'active' }),
    }),
    predecessorID: 'act_predecessor_elsewhere',
  });

  expect(disposition).toBe('rejected');
});

test('it rejects a start that names no predecessor', () => {
  const disposition = pickRefusedSnapshotDisposition({
    latest: createMockLatestActivityProgress({
      activity: createMockActivityData({ status: 'active' }),
    }),
    predecessorID: null,
  });

  expect(disposition).toBe('rejected');
});

test('it rejects when the server holds no activity for the avatar', () => {
  const disposition = pickRefusedSnapshotDisposition({
    latest: null,
    predecessorID: 'act_predecessor_missing',
  });

  expect(disposition).toBe('rejected');
});
