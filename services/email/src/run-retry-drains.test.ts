import { expect, test } from 'bun:test';
import { runRetryDrains } from './run-retry-drains';

test('it stops draining once a drain reports a completed job', async () => {
  const recordedDelays: Array<number> = [];

  const drainResults = [
    { completed: 0, failed: 0 },
    { completed: 1, failed: 0 },
  ];

  await runRetryDrains({
    drain: () => Promise.resolve(drainResults.shift() ?? { completed: 0, failed: 1 }),
    now: () => 0,
    usefulUntil: new Date(1_000_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([5000, 5000]);
});

test('it stops draining once the deadline has passed', async () => {
  const recordedDelays: Array<number> = [];
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 1 });
    },
    now: () => 1,
    usefulUntil: new Date(0),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toBeEmpty();
  expect(drainCalls).toBe(0);
});

test('it keeps polling while every drain reports no completion until the deadline passes', async () => {
  const recordedDelays: Array<number> = [];
  let elapsedMs = 0;
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 1 });
    },
    now: () => elapsedMs,
    usefulUntil: new Date(14_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      elapsedMs += ms;

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([5000, 5000, 5000]);
  expect(drainCalls).toBe(2);
});
