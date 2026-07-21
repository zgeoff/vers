import { expect, test } from 'bun:test';
import { createWorkerSlice } from './create-worker-slice';

test('it builds the empty worker state', () => {
  expect(createWorkerSlice()).toStrictEqual({
    initialized: false,
    transport: null,
    writerGeneration: 0,
  });
});
