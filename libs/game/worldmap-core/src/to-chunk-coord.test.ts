import { expect, test } from 'bun:test';
import { CHUNK_SIZE } from './consts';
import { toChunkCoord } from './to-chunk-coord';

test('it maps the origin cell to the origin chunk', () => {
  expect(toChunkCoord(0, 0)).toStrictEqual([0, 0]);
});

test('it keeps a cell inside the first chunk', () => {
  expect(toChunkCoord(CHUNK_SIZE - 1, CHUNK_SIZE - 1)).toStrictEqual([0, 0]);
});

test('it rolls over to the next chunk at the boundary', () => {
  expect(toChunkCoord(CHUNK_SIZE, 0)).toStrictEqual([1, 0]);
});

test('it floors negative cells into the chunk below', () => {
  expect(toChunkCoord(-1, -1)).toStrictEqual([-1, -1]);
  expect(toChunkCoord(-CHUNK_SIZE, 0)).toStrictEqual([-1, 0]);
});
