import { expect, mock, test } from 'bun:test';
import { makeAnswerQueue } from '@vers/test-utils';
import type { FlyMachine } from './types';
import { wakeMachines } from './wake-machines';

test('it starts each machine that is not started and reports the fleet started', async () => {
  const listAnswers = makeAnswerQueue<ReadonlyArray<FlyMachine>>([
    [
      { id: '1781e2db', state: 'suspended' },
      { id: '9080d3ef', state: 'started' },
    ],
    [
      { id: '1781e2db', state: 'started' },
      { id: '9080d3ef', state: 'started' },
    ],
  ]);

  const start = mock(async (_id: string) => {});

  const outcome = await wakeMachines(
    { list: () => Promise.resolve(listAnswers()), start },
    { timeoutMs: 1000, pollIntervalMs: 1 },
  );

  expect(outcome).toBe('started');
  expect(start).toHaveBeenCalledExactlyOnceWith('1781e2db');
});

test('it polls the fleet until every machine reports started', async () => {
  const listAnswers = makeAnswerQueue<ReadonlyArray<FlyMachine>>([
    [{ id: '1781e2db', state: 'stopped' }],
    [{ id: '1781e2db', state: 'starting' }],
    [{ id: '1781e2db', state: 'started' }],
  ]);

  const outcome = await wakeMachines(
    { list: () => Promise.resolve(listAnswers()), start: async () => {} },
    { timeoutMs: 1000, pollIntervalMs: 1 },
  );

  expect(outcome).toBe('started');
});

test('it times out when a machine has not started by the deadline', async () => {
  const listAnswers = makeAnswerQueue<ReadonlyArray<FlyMachine>>([
    [{ id: '1781e2db', state: 'stopped' }],
    [{ id: '1781e2db', state: 'starting' }],
  ]);

  const outcome = await wakeMachines(
    { list: () => Promise.resolve(listAnswers()), start: async () => {} },
    { timeoutMs: 0, pollIntervalMs: 1 },
  );

  expect(outcome).toBe('timed-out');
});

test('it times out when the app has no machine to start', async () => {
  const listAnswers = makeAnswerQueue<ReadonlyArray<FlyMachine>>([[], []]);

  const outcome = await wakeMachines(
    { list: () => Promise.resolve(listAnswers()), start: async () => {} },
    { timeoutMs: 0, pollIntervalMs: 1 },
  );

  expect(outcome).toBe('timed-out');
});
