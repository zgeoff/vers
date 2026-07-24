import { expect, test } from 'bun:test';
import { buildCellNode } from './build-cell-node';
import { buildChunk } from './build-chunk';
import { CHUNK_SIZE } from './consts';

const SEED = 999;

test('it carries a node for every cell in the chunk', () => {
  expect(buildChunk(SEED, 0, 0)).toHaveLength(CHUNK_SIZE * CHUNK_SIZE);
});

test('it spans the chunk from its base cell to the far corner', () => {
  const nodes = buildChunk(SEED, 1, -1);

  expect(nodes[0]?.coord).toStrictEqual([CHUNK_SIZE, -CHUNK_SIZE]);
  expect(nodes.at(-1)?.coord).toStrictEqual([2 * CHUNK_SIZE - 1, -1]);
});

test('it agrees with the single-cell builder', () => {
  const nodes = buildChunk(SEED, 0, 0);

  expect(nodes[0]).toStrictEqual(buildCellNode(SEED, 0, 0));
});

test('it holds no duplicate ids', () => {
  const nodes = buildChunk(SEED, 0, 0);

  const ids = new Set(nodes.map((node) => node.id));

  expect(ids.size).toBe(nodes.length);
});
