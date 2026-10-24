import { expect, test } from 'bun:test';
import { createBackgroundDrains } from './create-background-drains';

test('it waits for tracked work before the stop resolves', async () => {
  const drains = createBackgroundDrains();
  const work = Promise.withResolvers<void>();
  let workSettled = false;

  void drains.track(work.promise);
  const stopping = drains.stop(30_000);

  setImmediate(() => {
    workSettled = true;

    work.resolve();
  });

  await stopping;

  expect(workSettled).toBeTrue();
});

test('it stops waiting for hung work once the timeout passes', async () => {
  const drains = createBackgroundDrains();

  void drains.track(Promise.withResolvers<void>().promise);

  await expect(drains.stop(10)).toResolve();
});

test('it aborts the signal once the stop begins', () => {
  const drains = createBackgroundDrains();

  void drains.stop(10);
  expect(drains.signal.aborted).toBeTrue();
});

test('it hands back the rejection of tracked work and still stops', async () => {
  const drains = createBackgroundDrains();
  const failing = drains.track(Promise.reject(new Error('drain failed')));

  expect(failing).rejects.toThrow('drain failed');

  await expect(drains.stop(30_000)).toResolve();
});
