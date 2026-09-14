import { expect, test } from 'bun:test';
import { createDebugRecorder } from './create-debug-recorder';

test('it returns events oldest first and keeps only the newest once the capacity is reached', () => {
  let tick = 0;
  const recorder = createDebugRecorder({ capacity: 3, now: () => ++tick });

  recorder.recordEvent('lifecycle', 'idle');
  recorder.recordEvent('lifecycle', 'starting');
  recorder.recordEvent('lifecycle', 'running');
  recorder.recordEvent('connectivity', 'offline');

  expect(recorder.getEvents()).toStrictEqual([
    { at: 3, detail: 'starting', type: 'lifecycle' },
    { at: 4, detail: 'running', type: 'lifecycle' },
    { at: 5, detail: 'offline', type: 'connectivity' },
  ]);
});

test('it returns the events recorded so far while the buffer is not yet full', () => {
  let tick = 0;
  const recorder = createDebugRecorder({ capacity: 3, now: () => ++tick });

  recorder.recordEvent('connectivity', 'online');

  expect(recorder.getEvents()).toStrictEqual([{ at: 2, detail: 'online', type: 'connectivity' }]);
});

test('it keeps the last flush per activity and writes a one-line flush event', () => {
  let tick = 0;
  const recorder = createDebugRecorder({ now: () => ++tick });

  recorder.recordFlush('act_1', { appendedHead: 4, tailQueued: false, type: 'success' });
  recorder.recordFlush('act_1', { reason: 'hash-mismatch', type: 'invalid' });
  recorder.recordFlush('act_2', { type: 'empty' });

  expect(recorder.getFlushRecords()).toStrictEqual(
    new Map([
      ['act_1', { appendedHead: null, at: 4, reason: 'hash-mismatch', type: 'invalid' }],
      ['act_2', { appendedHead: null, at: 6, reason: null, type: 'empty' }],
    ]),
  );

  expect(recorder.getEvents().map((event) => event.detail)).toStrictEqual([
    'act_1 success head=4',
    'act_1 invalid reason=hash-mismatch',
    'act_2 empty',
  ]);
});

test('it counts start attempts per activity and keeps the last refusal', () => {
  let tick = 0;
  const recorder = createDebugRecorder({ now: () => ++tick });

  recorder.recordStartAttempt('act_1', 'deferred', {
    code: 'CHECKPOINT_INVALID',
    reason: 'build-snapshot-mismatch',
  });

  recorder.recordStartAttempt('act_1', 'deferred', { code: 'AVATAR_NOT_ACTIVE', reason: null });
  recorder.recordStartAttempt('act_2', 'ingested', null);

  expect(recorder.getStartAttempts()).toStrictEqual(
    new Map([
      [
        'act_1',
        {
          attempts: 2,
          lastAttemptAt: 4,
          lastOutcome: 'deferred',
          lastRefusal: { code: 'AVATAR_NOT_ACTIVE', reason: null },
        },
      ],
      ['act_2', { attempts: 1, lastAttemptAt: 6, lastOutcome: 'ingested', lastRefusal: null }],
    ]),
  );

  expect(recorder.getEvents().map((event) => event.detail)).toStrictEqual([
    'act_1 deferred refused=CHECKPOINT_INVALID/build-snapshot-mismatch',
    'act_1 deferred refused=AVATAR_NOT_ACTIVE',
    'act_2 ingested',
  ]);
});

test('it stamps the boot time and mints a worker id', () => {
  const recorder = createDebugRecorder({ now: () => 1234 });

  expect(recorder.bootedAt).toBe(1234);
  expect(recorder.workerID).toBeString();
  expect(createDebugRecorder().workerID).not.toBe(recorder.workerID);
});
