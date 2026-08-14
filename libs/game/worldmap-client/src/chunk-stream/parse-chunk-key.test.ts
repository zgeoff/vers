import { expect, test } from 'bun:test';
import { buildChunkKey } from './build-chunk-key';
import { parseChunkKey } from './parse-chunk-key';

test('it recovers the coordinate a matching buildChunkKey call encoded', () => {
  expect(parseChunkKey(buildChunkKey(3, -7))).toStrictEqual([3, -7]);
});

test('it rejects a key with a non-numeric component', () => {
  expect(() => parseChunkKey('3_north')).toThrow();
});

test('it rejects a key missing its second component', () => {
  expect(() => parseChunkKey('3')).toThrow();
});
