import { expect, test } from 'bun:test';
import { createViewportSlice } from './create-viewport-slice';

test('it builds the empty viewport state', () => {
  expect(createViewportSlice()).toStrictEqual({
    viewport: null,
  });
});
