import { expect, onTestFinished, test } from 'bun:test';
import { readProcessStartTime } from './read-process-start-time';

test('it reads the same start time for a live process each time', async () => {
  const child = Bun.spawn(['sleep', '30']);

  onTestFinished(() => {
    child.kill('SIGKILL');
  });

  const first = await readProcessStartTime(child.pid);
  const second = await readProcessStartTime(child.pid);

  expect(first).toMatch(/^\d+$/u);
  expect(second).toBe(first);
});

test('it reads no start time for a process that exited', async () => {
  const child = Bun.spawn(['true']);

  await child.exited;

  const startTime = await readProcessStartTime(child.pid);

  expect(startTime).toBeUndefined();
});
