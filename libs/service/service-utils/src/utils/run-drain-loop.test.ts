import { expect, mock, test } from 'bun:test';
import { makeAnswerQueue } from '@vers/test-utils';
import { runDrainLoop } from './run-drain-loop';

test('it runs steps until one reports the queue idle and returns the steps in order', async () => {
  const nextStep = makeAnswerQueue<string | null>(['first', 'second', null]);

  const steps = await runDrainLoop(() => Promise.resolve(nextStep()));

  expect(steps).toStrictEqual(['first', 'second']);
});

test('it returns no steps when the queue starts idle', async () => {
  const runStep = mock(() => Promise.resolve(null));

  const steps = await runDrainLoop(runStep);

  expect(steps).toStrictEqual([]);
  expect(runStep).toHaveBeenCalledOnce();
});

test('it rejects with the error a step throws', () => {
  const nextStep = makeAnswerQueue<() => Promise<string | null>>([
    () => Promise.resolve('first'),
    () => Promise.reject(new Error('claim failed')),
  ]);

  expect(runDrainLoop(() => nextStep()())).rejects.toThrowWithMessage(Error, 'claim failed');
});
