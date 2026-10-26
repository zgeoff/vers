import { expect, mock, test } from 'bun:test';
import { getLogger } from '@logtape/logtape';
import { mockReplayService } from '@vers/mock-services/replay';
import { waitFor } from '@vers/test-utils';
import { createInMemoryMetrics, updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { server } from '../mocks/server';
import { makeSendReplayWake } from './make-send-replay-wake';

test('it retries a failed client build on the next call', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const sendReplayWake = makeSendReplayWake({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
  });

  const validPrivateKey = process.env['SERVICE_AUTH_PRIVATE_KEY'];

  invariant(validPrivateKey !== undefined, 'the test env always sets SERVICE_AUTH_PRIVATE_KEY');
  updateEnv('SERVICE_AUTH_PRIVATE_KEY', 'not-a-valid-pkcs8-key');

  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  sendReplayWake();

  await waitFor(
    async () => {
      const pokeFailures = await inMemoryMetrics.readCounterValue(
        'vers.activity.replay_poke_failed',
      );

      expect(pokeFailures).toBe(1);
    },
    { timeoutMs: 3000 },
  );

  // the malformed key never parses, so every retry fails before ever reaching the RPC layer
  expect(wakeHandler).not.toHaveBeenCalled();

  updateEnv('SERVICE_AUTH_PRIVATE_KEY', validPrivateKey);
  sendReplayWake();

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );
});

test('it keeps the cached client after a wake-call failure, without rebuilding it', async () => {
  const sendReplayWake = makeSendReplayWake({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
  });

  // warms up a known-good cached client before the failure injection below, so the assertion
  // isolates a wake-call failure from an unbuilt cache
  const warmupHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(warmupHandler));

  sendReplayWake();

  await waitFor(
    () => {
      expect(warmupHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );

  // a malformed key at call time would fail a rebuild before ever reaching the handler below — the
  // handler being reached three times over proves the client warmed up above is what's reused
  updateEnv('SERVICE_AUTH_PRIVATE_KEY', 'not-a-valid-pkcs8-key');

  const failingHandler = mock(() => {
    throw new Error('simulated wake delivery failure');
  });

  server.use(mockReplayService.wake.handler(failingHandler));

  sendReplayWake();

  await waitFor(
    () => {
      expect(failingHandler).toHaveBeenCalledTimes(3);
    },
    { timeoutMs: 3000 },
  );
});

test('it aborts its in-flight wake when its signal aborts', async () => {
  const wakeHandler = mock(
    (_options: Readonly<Record<'request', Request>>) => new Promise<{ drained: number }>(() => {}),
  );

  server.use(mockReplayService.wake.handler(wakeHandler));

  const lifetime = new AbortController();

  const sendReplayWake = makeSendReplayWake({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
    signal: lifetime.signal,
  });

  sendReplayWake();

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );

  const requestSignal = wakeHandler.mock.calls[0]?.[0].request.signal;

  invariant(requestSignal, 'the RPC handler receives the request signal');

  const abortedBeforeStop = requestSignal.aborted;

  lifetime.abort();

  // under the per-attempt timeout, so only the stop can abort the request this soon
  await waitFor(
    () => {
      expect(requestSignal.aborted).toBeTrue();
    },
    { timeoutMs: 1000 },
  );

  expect(abortedBeforeStop).toBeFalse();
});

test('it gives each instance its own coalesce state', async () => {
  // each poke fires while the other instance's delivery is still building its client; a shared
  // in-flight guard would let the first swallow the second, delivering one wake instead of two
  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  const pokeFirst = makeSendReplayWake({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
  });

  const pokeSecond = makeSendReplayWake({
    coalesceWindowMs: 0,
    logger: getLogger(['test-activity']),
  });

  pokeFirst();
  pokeSecond();

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledTimes(2);
    },
    { timeoutMs: 2000 },
  );
});
