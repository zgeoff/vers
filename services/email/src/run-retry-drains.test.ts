import { expect, test } from 'bun:test';
import { runRetryDrains } from './run-retry-drains';

test('it stops draining once a drain reports no failure', async () => {
  const recordedDelays: Array<number> = [];

  const drainResults = [
    { completed: 0, failed: 1 },
    { completed: 1, failed: 0 },
  ];

  await runRetryDrains({
    drain: () => Promise.resolve(drainResults.shift() ?? { completed: 0, failed: 0 }),
    now: () => 0,
    usefulUntil: new Date(1_000_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([16_000, 31_000]);
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

  expect(recordedDelays).toStrictEqual([16_000]);
  expect(drainCalls).toBe(0);
});

test('it runs every scheduled drain while each one keeps failing', async () => {
  const recordedDelays: Array<number> = [];
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 1 });
    },
    now: () => 0,
    usefulUntil: new Date(1_000_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([16_000, 31_000, 61_000, 121_000]);
  expect(drainCalls).toBe(4);
});
