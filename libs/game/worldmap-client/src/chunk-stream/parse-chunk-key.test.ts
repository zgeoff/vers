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

test('it rejects a key with an empty component that would coerce to zero', () => {
  expect(() => parseChunkKey('3_')).toThrow();
  expect(() => parseChunkKey('_4')).toThrow();
});

test('it rejects a key carrying more than two components', () => {
  expect(() => parseChunkKey('3_4_5')).toThrow();
  expect(() => parseChunkKey('3__4')).toThrow();
});
