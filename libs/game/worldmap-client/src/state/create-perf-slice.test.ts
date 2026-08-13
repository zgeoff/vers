import { expect, test } from 'bun:test';
import { createPerfSlice } from './create-perf-slice';

test('it builds the unsampled perf state', () => {
  expect(createPerfSlice()).toStrictEqual({
    perfStats: null,
  });
});
