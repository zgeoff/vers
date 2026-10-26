import { expect, test } from 'bun:test';
import { getLogger } from '@logtape/logtape';
import { runScheduledDrain } from './run-scheduled-drain';

test('it exits 0 when the drain and the teardown both succeed', async () => {
  const exitCode = await runScheduledDrain({
    drain: () => Promise.resolve(3),
    logger: getLogger(['test-replay']),
    stop: () => Promise.resolve(),
  });

  expect(exitCode).toBe(0);
});

test('it exits 1 when the teardown fails after a drain that succeeded', async () => {
  const exitCode = await runScheduledDrain({
    drain: () => Promise.resolve(3),
    logger: getLogger(['test-replay']),
    stop: () => Promise.reject(new Error('pool close timed out')),
  });

  expect(exitCode).toBe(1);
});

test('it exits 1 when the drain fails, and still tears down', async () => {
  const stopped: Array<string> = [];

  const exitCode = await runScheduledDrain({
    drain: () => Promise.reject(new Error('replay queue unreachable')),
    logger: getLogger(['test-replay']),
    stop: () => {
      stopped.push('service');

      return Promise.resolve();
    },
  });

  expect(exitCode).toBe(1);
  expect(stopped).toStrictEqual(['service']);
});
