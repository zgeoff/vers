import { expect, test } from 'bun:test';
import { createStubFlyctl } from '../test-utils/create-stub-flyctl';
import { runFlyctl } from './run-flyctl';

test('it returns what flyctl wrote to stdout', async () => {
  await createStubFlyctl('echo "$@"');

  expect(runFlyctl(['machines', 'list', '--json'])).resolves.toBe('machines list --json');
});

test('it ends a flyctl call that is still pending when the cancel signal aborts', async () => {
  await createStubFlyctl('exec sleep 30');

  expect(
    runFlyctl(['machines', 'list'], { cancelSignal: AbortSignal.timeout(50) }),
  ).rejects.toMatchObject({ isCanceled: true, isTerminated: true });
});

test('it sends SIGINT to a flyctl call that outlives its interrupt deadline', async () => {
  await createStubFlyctl("trap 'echo interrupted; exit 130' INT\nwhile true; do sleep 0.05; done");

  expect(
    runFlyctl(['deploy'], { interrupt: { afterMs: 100, graceMs: 2000 } }),
  ).rejects.toMatchObject({ exitCode: 130, stdout: 'interrupted', timedOut: true });
});

test('it kills a flyctl call that ignores SIGINT once the grace runs out', async () => {
  await createStubFlyctl("trap '' INT\nwhile true; do sleep 0.05; done");

  expect(
    runFlyctl(['deploy'], { interrupt: { afterMs: 100, graceMs: 100 } }),
  ).rejects.toMatchObject({ signal: 'SIGKILL', timedOut: true });
});
