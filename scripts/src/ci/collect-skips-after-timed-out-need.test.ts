import { expect, test } from 'bun:test';
import { collectSkipsAfterTimedOutNeed } from './collect-skips-after-timed-out-need';

test('it reports a failure handler that refuses a timed-out need', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    ['wash', { needs: [], condition: 'success()', cancelsInProgress: false }],
    [
      'alarm',
      {
        needs: ['bake', 'wash'],
        condition:
          "!cancelled() && contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')",
        cancelsInProgress: false,
      },
    ],
  ]);

  expect(collectSkipsAfterTimedOutNeed(jobs)).toStrictEqual([
    { job: 'alarm', timedOutJob: 'bake' },
    { job: 'alarm', timedOutJob: 'wash' },
  ]);
});

test('it reports a failure handler gated on failure() alone when a need times out', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: false }],
    ['alarm', { needs: ['bake'], condition: 'failure()', cancelsInProgress: false }],
  ]);

  expect(collectSkipsAfterTimedOutNeed(jobs)).toStrictEqual([
    { job: 'alarm', timedOutJob: 'bake' },
  ]);
});

test('it passes a failure handler that runs on a timed-out need', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
    ['wash', { needs: [], condition: 'success()', cancelsInProgress: false }],
    [
      'alarm',
      {
        needs: ['bake', 'wash'],
        condition:
          "!cancelled() && (contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled'))",
        cancelsInProgress: false,
      },
    ],
  ]);

  expect(collectSkipsAfterTimedOutNeed(jobs)).toStrictEqual([]);
});

test('it passes a job that skips after a timed-out need when it also runs on success', () => {
  const jobs = new Map([
    ['bake', { needs: [], condition: 'success()', cancelsInProgress: false }],
    [
      'serve',
      {
        needs: ['bake'],
        condition: "!cancelled() && !contains(needs.*.result, 'cancelled')",
        cancelsInProgress: false,
      },
    ],
  ]);

  expect(collectSkipsAfterTimedOutNeed(jobs)).toStrictEqual([]);
});
