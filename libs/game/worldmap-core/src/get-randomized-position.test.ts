import { expect, test } from 'bun:test';
import { createRNG, stateFromSeed } from '@vers/game-utils';
import { getRandomizedPosition } from './get-randomized-position';

test('it returns a position within the expected range', () => {
  const rng = createRNG(stateFromSeed(12_345));
  const position = getRandomizedPosition([0, 0], rng);

  expect(position).toMatchInlineSnapshot(`
    [
      -0.188,
      -0.021,
    ]
  `);
});
