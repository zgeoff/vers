import { expect, test } from 'bun:test';
import type { JobState } from '@vers/jobs';
import { runRetryDrains } from './run-retry-drains';

test("it stops draining once the job's state is completed", async () => {
  const recordedDelays: Array<number> = [];
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 1, failed: 0 });
    },
    getState: () => Promise.resolve('completed'),
    now: () => 0,
    usefulUntil: new Date(1_000_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([5000]);
  expect(drainCalls).toBe(0);
});

test("it stops draining once the job's state is failed", async () => {
  const recordedDelays: Array<number> = [];
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 0 });
    },
    getState: () => Promise.resolve('failed'),
    now: () => 0,
    usefulUntil: new Date(1_000_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([5000]);
  expect(drainCalls).toBe(0);
});

test('it stops draining once the effective deadline passes with the job still in retry', async () => {
  const recordedDelays: Array<number> = [];
  let elapsedMs = 0;
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 1 });
    },
    getState: () => Promise.resolve('retry'),
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

test("it keeps draining while the job's state stays retry", async () => {
  const recordedDelays: Array<number> = [];
  let drainCalls = 0;
  const states: Array<JobState> = ['retry', 'retry', 'completed'];

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 1 });
    },
    getState: () => Promise.resolve(states.shift() ?? 'completed'),
    now: () => 0,
    usefulUntil: new Date(1_000_000),
    wait: (ms) => {
      recordedDelays.push(ms);

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual([5000, 5000, 5000]);
  expect(drainCalls).toBe(2);
});

test('it caps a far-future usefulUntil at the eight-minute maximum duration', async () => {
  const recordedDelays: Array<number> = [];
  let elapsedMs = 0;
  let drainCalls = 0;

  await runRetryDrains({
    drain: () => {
      drainCalls += 1;

      return Promise.resolve({ completed: 0, failed: 1 });
    },
    getState: () => Promise.resolve('retry'),
    now: () => elapsedMs,
    usefulUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    wait: (ms) => {
      recordedDelays.push(ms);

      elapsedMs += ms;

      return Promise.resolve();
    },
  });

  expect(recordedDelays).toStrictEqual(Array.from({ length: 96 }, () => 5000));
  expect(drainCalls).toBe(95);
});
