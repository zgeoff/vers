import { expect, test } from 'bun:test';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { isSharedWorkerSupported } from './is-shared-worker-supported';

test('it reports support when the SharedWorker constructor exists', () => {
  expect(isSharedWorkerSupported()).toBe(true);
});

test('it reports no support when the SharedWorker constructor is absent', () => {
  removeSharedWorker();

  expect(isSharedWorkerSupported()).toBe(false);
});
