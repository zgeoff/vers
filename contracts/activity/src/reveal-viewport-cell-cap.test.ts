import { expect, test } from 'bun:test';
import { REVEAL_VIEWPORT_CELL_CAP } from './reveal-viewport-cell-cap';

test('it caps a reveal viewport at 4096 cells', () => {
  expect(REVEAL_VIEWPORT_CELL_CAP).toBe(4096);
});
