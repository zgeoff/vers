import { expect, test } from 'bun:test';
import { createWorkerSlice } from './create-worker-slice';

test('it builds the empty worker state', () => {
  const slice = createWorkerSlice();

  expect(slice.client).toBeNull();
  expect(slice.initialized).toBeFalse();
  expect(slice.writerGeneration).toBe(0);
  expect(slice.writerAbortController).toBeInstanceOf(AbortController);
  expect(slice.writerAbortController.signal.aborted).toBeFalse();
});
