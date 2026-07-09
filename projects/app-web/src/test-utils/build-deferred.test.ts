import { expect, test } from 'bun:test';
import { buildDeferred } from './build-deferred';

test('it leaves the promise pending until released', async () => {
  const deferred = buildDeferred<string>();
  const pendingMarker = Symbol('pending');

  const beforeRelease = await Promise.race([deferred.promise, Promise.resolve(pendingMarker)]);

  expect(beforeRelease).toBe(pendingMarker);

  await deferred.release('done');

  const afterRelease = await deferred.promise;

  expect(afterRelease).toBe('done');
});

test('it resolves the promise with the released value', async () => {
  const deferred = buildDeferred<number>();

  await deferred.release(42);

  const value = await deferred.promise;

  expect(value).toBe(42);
});
