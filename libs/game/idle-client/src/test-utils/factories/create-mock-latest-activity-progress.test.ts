import { expect, test } from 'bun:test';
import { createMockLatestActivityProgress } from './create-mock-latest-activity-progress';

test('it builds an active-activity snapshot with fresh cursors by default', () => {
  const progress = createMockLatestActivityProgress();

  expect(progress.activity.status).toBe('active');
  expect(progress.anchor).toBeNull();
  expect(progress.appendedHead).toBe(0);
  expect(progress.verifiedHead).toBe(0);
  expect(progress.serverTime).toBeValidDate();
});

test('it applies overrides over the defaults', () => {
  const serverTime = new Date('2026-07-14T12:00:00Z');

  const progress = createMockLatestActivityProgress({ appendedHead: 4, serverTime });

  expect(progress.appendedHead).toBe(4);
  expect(progress.serverTime).toBe(serverTime);
});
