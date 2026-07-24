import { expect, test } from 'bun:test';
import { buildCellNode } from './build-cell-node';
import { JITTER } from './consts';
import { toHexPosition } from './to-hex-position';

const SEED = 12_345;

test('it is deterministic for a seed and coordinate', () => {
  expect(buildCellNode(SEED, 4, -2)).toStrictEqual(buildCellNode(SEED, 4, -2));
});

test('it identifies the node by its cell coordinate', () => {
  const node = buildCellNode(SEED, 4, -2);

  expect(node.id).toBe('4_-2');
  expect(node.coord).toStrictEqual([4, -2]);
});

test('it keeps the jittered position within the jitter bound of the cell center', () => {
  const [centerX, centerY] = toHexPosition(4, -2);
  const node = buildCellNode(SEED, 4, -2);

  expect(Math.abs(node.position[0] - centerX)).toBeLessThanOrEqual(JITTER);
  expect(Math.abs(node.position[1] - centerY)).toBeLessThanOrEqual(JITTER);
});

test('it shifts the layout when the avatar seed changes', () => {
  expect(buildCellNode(SEED, 4, -2).position).not.toStrictEqual(
    buildCellNode(SEED + 1, 4, -2).position,
  );
});

test('it builds a stable node', () => {
  expect(buildCellNode(SEED, 1, 1)).toMatchInlineSnapshot(`
    {
      "coord": [
        1,
        1,
      ],
      "difficulty": 2,
      "id": "1_1",
      "position": [
        2.4216949547357105,
        1.3081833966076375,
      ],
    }
  `);
});
