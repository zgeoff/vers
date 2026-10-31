import { expect, test } from 'bun:test';
import { collectRunsAfterCancelledNeed } from './collect-runs-after-cancelled-need';

test('it reports a job that runs after a need its concurrency group cancels', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    [
      'taste',
      {
        needs: ['bake'],
        condition: "!cancelled() && needs.bake.result != 'failure'",
        cancelsInProgress: false,
      },
    ],
  ]);

  expect(collectRunsAfterCancelledNeed(jobs)).toStrictEqual([
    { job: 'taste', cancelledJob: 'bake' },
  ]);
});

test('it passes a job that refuses a cancelled need', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    [
      'taste',
      {
        needs: ['bake'],
        condition: "!cancelled() && !contains(needs.*.result, 'cancelled')",
        cancelsInProgress: false,
      },
    ],
  ]);

  expect(collectRunsAfterCancelledNeed(jobs)).toStrictEqual([]);
});

test('it passes a job with no status function after a cancelled need', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    [
      'taste',
      { needs: ['bake'], condition: "needs.bake.result != 'failure'", cancelsInProgress: false },
    ],
  ]);

  expect(collectRunsAfterCancelledNeed(jobs)).toStrictEqual([]);
});

test('it passes a job after a need that never cancels', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: false }],
    ['taste', { needs: ['bake'], condition: 'always()', cancelsInProgress: false }],
  ]);

  expect(collectRunsAfterCancelledNeed(jobs)).toStrictEqual([]);
});

test('it reports a job that runs after a cancelled job it reaches through a skipped need', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    [
      'plate',
      {
        needs: ['bake'],
        condition: "!cancelled() && needs.bake.result == 'success'",
        cancelsInProgress: false,
      },
    ],
    ['serve', { needs: ['plate'], condition: '!cancelled()', cancelsInProgress: false }],
  ]);

  expect(collectRunsAfterCancelledNeed(jobs)).toStrictEqual([
    { job: 'serve', cancelledJob: 'bake' },
  ]);
});

test('it counts a job that runs after the cancel as passed for the jobs after it', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    ['taste', { needs: ['bake'], condition: '!cancelled()', cancelsInProgress: false }],
    [
      'serve',
      {
        needs: ['taste'],
        condition: "!cancelled() && needs.taste.result == 'success'",
        cancelsInProgress: false,
      },
    ],
  ]);

  expect(collectRunsAfterCancelledNeed(jobs)).toStrictEqual([
    { job: 'taste', cancelledJob: 'bake' },
    { job: 'serve', cancelledJob: 'bake' },
  ]);
});
