import { expect, mock, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { makeReplayWaker } from './make-replay-waker';
import type { WakeAttempt } from './make-replay-waker';

test('it never throws into the caller', () => {
  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake: mock(() => Promise.resolve()),
  });

  expect(() => {
    waker.sendReplayWake();
  }).not.toThrow();
});

test('it coalesces a synchronous burst into one delivery', async () => {
  const sendWake = mock(() => Promise.resolve());

  const waker = makeReplayWaker({
    coalesceWindowMs: 1000,
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
  });

  waker.sendReplayWake();
  waker.sendReplayWake();
  waker.sendReplayWake();

  await waker.waitUntilSettled();

  expect(sendWake).toHaveBeenCalledTimes(1);
});

test('it keeps a single delivery in flight while one is still pending', async () => {
  const gate = makeDeferred<void>();
  const sendWake = mock(() => gate.promise);

  const waker = makeReplayWaker({
    // coalesceWindowMs 0 disables the time window, so only the in-flight guard can coalesce here
    coalesceWindowMs: 0,
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
  });

  waker.sendReplayWake();
  waker.sendReplayWake();
  gate.resolve();

  await waker.waitUntilSettled();

  expect(sendWake).toHaveBeenCalledTimes(1);
});

test('it retries a failed delivery then records the poke-failure counter', async () => {
  const inMemoryMetrics = createInMemoryMetrics();
  const sendWake = mock(() => Promise.reject(new Error('simulated wake delivery failure')));

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
  });

  waker.sendReplayWake();

  await waker.waitUntilSettled();

  const pokeFailures = await inMemoryMetrics.readCounterValue('vers.activity.replay_poke_failed');

  expect(sendWake).toHaveBeenCalledTimes(3);
  expect(pokeFailures).toBe(1);
});

test('it aborts a hung attempt and records the poke-failure counter after exhausting retries', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const sendWake = mock(
    (options: WakeAttempt) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      }),
  );

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
  });

  waker.sendReplayWake();

  await waker.waitUntilSettled();

  const pokeFailures = await inMemoryMetrics.readCounterValue('vers.activity.replay_poke_failed');

  expect(sendWake).toHaveBeenCalledTimes(3);
  expect(pokeFailures).toBe(1);
});

function makeDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let settle!: (value: T) => void;

  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });

  return { promise, resolve: settle };
}
