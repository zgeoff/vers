import { expect, test } from 'bun:test';
import { runWorkerCloneProbe } from './run-worker-clone-probe';

test('it leaves no database behind once a plain test run exits', async () => {
  const probe = await runWorkerCloneProbe(['--randomize']);

  expect(probe.exitCode, probe.output).toBe(0);
  expect(new Set(probe.acquired).size).toBe(2);
  expect(probe.remaining).toStrictEqual([]);
});

test('it leaves no database behind once a parallel test run exits', async () => {
  const probe = await runWorkerCloneProbe(['--parallel=2', '--no-isolate']);

  expect(probe.exitCode, probe.output).toBe(0);
  expect(new Set(probe.acquired).size).toBe(2);
  expect(probe.remaining).toStrictEqual([]);
});
