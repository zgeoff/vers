import { expect, test } from 'bun:test';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createMockLatestActivityProgress } from '../test-utils/factories/create-mock-latest-activity-progress';
import { planResync } from './plan-resync';

test('it rebases from the stop index when the activity is capped', () => {
  const activity = createMockActivityData({ appendedHead: 7, status: 'capped' });
  const progress = createMockLatestActivityProgress({ activity, appendedHead: 7 });

  expect(planResync({ progress })).toStrictEqual({
    context: {
      activityID: activity.id,
      appendedHead: 7,
      lastHash: activity.lastHash,
      startChainIndex: activity.startChainIndex,
    },
    kind: 'rebase',
  });
});

test('it plans nothing for a stopped activity', () => {
  const activity = createMockActivityData({ status: 'stopped' });

  expect(planResync({ progress: createMockLatestActivityProgress({ activity }) })).toStrictEqual({
    kind: 'none',
  });
});

test('it attaches live when the gap is not worth simulating', () => {
  const serverTime = new Date('2026-07-14T12:00:00Z');

  const activity = createMockActivityData({
    appendedAt: new Date(serverTime.getTime() - 4000),
  });

  const plan = planResync({ progress: createMockLatestActivityProgress({ activity, serverTime }) });

  expect(plan.kind).toBe('attach-live');
});

test('it fast-forwards the offline gap measured from the last append', () => {
  const serverTime = new Date('2026-07-14T12:00:00Z');

  const activity = createMockActivityData({
    appendedAt: new Date(serverTime.getTime() - 7_200_000),
  });

  const plan = planResync({ progress: createMockLatestActivityProgress({ activity, serverTime }) });

  expect(plan).toMatchObject({ budgetMs: 7_200_000, kind: 'fast-forward' });
});

test('it measures the gap from the start when nothing was appended', () => {
  const serverTime = new Date('2026-07-14T12:00:00Z');

  const activity = createMockActivityData({
    appendedAt: null,
    startedAt: new Date(serverTime.getTime() - 60_000),
  });

  const plan = planResync({ progress: createMockLatestActivityProgress({ activity, serverTime }) });

  expect(plan).toMatchObject({ budgetMs: 60_000, kind: 'fast-forward' });
});

test('it never budgets past the cap', () => {
  const serverTime = new Date('2026-07-14T12:00:00Z');

  const activity = createMockActivityData({
    appendedAt: new Date(serverTime.getTime() - 3 * OFFLINE_PROGRESS_CAP_MS),
  });

  const plan = planResync({ progress: createMockLatestActivityProgress({ activity, serverTime }) });

  expect(plan).toMatchObject({ budgetMs: OFFLINE_PROGRESS_CAP_MS, kind: 'fast-forward' });
});

test('it honours an injected cap', () => {
  const serverTime = new Date('2026-07-14T12:00:00Z');

  const activity = createMockActivityData({
    appendedAt: new Date(serverTime.getTime() - 7_200_000),
  });

  const plan = planResync({
    capMs: 60_000,
    progress: createMockLatestActivityProgress({ activity, serverTime }),
  });

  expect(plan).toMatchObject({ budgetMs: 60_000, kind: 'fast-forward' });
});
