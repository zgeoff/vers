import { expect, mock, test } from 'bun:test';
import { registerWorkerClone, releaseWorkerClones } from './register-worker-clone';

test('it runs every registered release once and then forgets them', async () => {
  const first = mock(() => Promise.resolve());
  const second = mock(() => Promise.resolve());

  registerWorkerClone(first);
  registerWorkerClone(second);

  await releaseWorkerClones();
  await releaseWorkerClones();

  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
});
