import { expect, mock, onTestFinished, test } from 'bun:test';
import { getLogger, resetSync } from '@logtape/logtape';
import { waitFor } from '@vers/test-utils';
import { createInMemoryLogs, createInMemoryMetrics } from '@vers/test-utils/bun';
import { makeReplayWaker } from './make-replay-waker';
import type { WakeAttempt } from './make-replay-waker';

test('it never throws into the caller', () => {
  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
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
    logger: getLogger(['test-activity']),
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
  const gate = Promise.withResolvers<void>();
  const sendWake = mock(() => gate.promise);

  const waker = makeReplayWaker({
    // coalesceWindowMs 0 disables the time window, so only the in-flight guard can coalesce here
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
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

test('it delivers once more for a wake that arrives while a delivery is in flight', async () => {
  const gate = Promise.withResolvers<void>();
  const sendWake = mock(() => gate.promise);

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
  });

  waker.sendReplayWake();

  await waitFor(() => {
    expect(sendWake).toHaveBeenCalledOnce();
  });

  waker.sendReplayWake();
  gate.resolve();

  await waker.waitUntilSettled();

  expect(sendWake).toHaveBeenCalledTimes(2);
});

test('it delivers a wake that arrives inside the coalesce window once the window closes', async () => {
  const sendWake = mock(() => Promise.resolve());

  const waker = makeReplayWaker({
    coalesceWindowMs: 50,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
  });

  waker.sendReplayWake();

  await waker.waitUntilSettled();

  waker.sendReplayWake();

  await waker.waitUntilSettled();

  expect(sendWake).toHaveBeenCalledTimes(2);
});

test('it sends nothing when its signal aborted before the first wake, unlike a live waker', async () => {
  const lifetime = new AbortController();

  const sendWakeStopped = mock(() => Promise.resolve());
  const sendWakeLive = mock(() => Promise.resolve());

  lifetime.abort();

  const stoppedWaker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake: sendWakeStopped,
    signal: lifetime.signal,
  });

  const liveWaker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake: sendWakeLive,
    signal: new AbortController().signal,
  });

  stoppedWaker.sendReplayWake();
  liveWaker.sendReplayWake();

  await Promise.all([stoppedWaker.waitUntilSettled(), liveWaker.waitUntilSettled()]);

  expect(sendWakeStopped).not.toHaveBeenCalled();
  expect(sendWakeLive).toHaveBeenCalledOnce();
});

test('it sends no trailing wake after its signal aborts', async () => {
  const lifetime = new AbortController();

  const sendWake = mock(() => Promise.resolve());

  const waker = makeReplayWaker({
    coalesceWindowMs: 60_000,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake,
    signal: lifetime.signal,
  });

  waker.sendReplayWake();

  await waitFor(() => {
    expect(sendWake).toHaveBeenCalledOnce();
  });

  waker.sendReplayWake();
  lifetime.abort();
  waker.sendReplayWake();

  await waker.waitUntilSettled();

  expect(sendWake).toHaveBeenCalledOnce();
});

test('it records no poke failure for a delivery that its signal aborted', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const lifetime = new AbortController();

  const sendWake = mock(
    (attempt: WakeAttempt) =>
      new Promise((_resolve, reject) => {
        attempt.signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      }),
  );

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 60_000,
    retryBackoffMs: 0,
    sendWake,
    signal: lifetime.signal,
  });

  waker.sendReplayWake();

  await waitFor(() => {
    expect(sendWake).toHaveBeenCalledOnce();
  });

  lifetime.abort();

  await waker.waitUntilSettled();

  const pokeFailures = await inMemoryMetrics.readCounterValue('vers.activity.replay_poke_failed');

  expect(pokeFailures).toBeUndefined();
});

test('it retries a failed delivery then records the poke-failure counter', async () => {
  const inMemoryMetrics = createInMemoryMetrics();
  const sendWake = mock(() => Promise.reject(new Error('simulated wake delivery failure')));

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
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
    logger: getLogger(['test-activity']),
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

test('it writes the poke-failed line once every retry fails', async () => {
  const logs = createInMemoryLogs({ lowestLevel: 'warning' });

  onTestFinished(() => {
    resetSync();
  });

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake: mock(() => Promise.reject(new Error('simulated wake delivery failure'))),
  });

  waker.sendReplayWake();

  await waker.waitUntilSettled();

  expect(logs.records).toHaveLength(1);

  expect(logs.records[0]).toMatchObject({
    level: 'warning',
    properties: { attempts: 3 },
    rawMessage: 'replay wake poke failed after every retry',
  });
});

test('it writes no poke-failed line when the delivery succeeds', async () => {
  const logs = createInMemoryLogs({ lowestLevel: 'warning' });

  onTestFinished(() => {
    resetSync();
  });

  const waker = makeReplayWaker({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    maxDeliveryAttempts: 3,
    perAttemptTimeoutMs: 5,
    retryBackoffMs: 0,
    sendWake: mock(() => Promise.resolve()),
  });

  waker.sendReplayWake();

  await waker.waitUntilSettled();

  expect(logs.records).toBeEmpty();
});
