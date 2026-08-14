import { expect, test } from 'bun:test';
import { buildChunkKey } from './build-chunk-key';

test('it joins a chunk coordinate with an underscore', () => {
  expect(buildChunkKey(3, -7)).toBe('3_-7');
});

test('it gives distinct coordinates distinct keys', () => {
  expect(buildChunkKey(1, 2)).not.toBe(buildChunkKey(2, 1));
});
