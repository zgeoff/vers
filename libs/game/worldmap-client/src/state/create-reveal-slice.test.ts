import { expect, test } from 'bun:test';
import { createRevealSlice } from './create-reveal-slice';

test('it builds the empty reveal state', () => {
  expect(createRevealSlice()).toStrictEqual({
    revealSources: null,
  });
});
