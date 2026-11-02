import { expect, test } from 'bun:test';
import { runInNamespace } from './run-in-namespace';

test('it throws with the reason when nsenter cannot reach the namespace', async () => {
  const child = Bun.spawn(['true']);

  await child.exited;

  expect(runInNamespace(child.pid, ['ip', 'link', 'show'])).rejects.toThrow(
    /^ip link show failed in the namespace: nsenter: /u,
  );
});
