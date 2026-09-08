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
