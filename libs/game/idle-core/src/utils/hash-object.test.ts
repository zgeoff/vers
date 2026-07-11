import { expect, test } from 'bun:test';
import xxhash from 'xxhash-wasm';
import { hashObject } from './hash-object';

const hasher = await xxhash();

test('returns consistent hash for the same object', () => {
  const obj = { a: 1, b: 'test', c: true };

  const hash1 = hashObject(hasher, obj);
  const hash2 = hashObject(hasher, obj);

  expect(hash1).toBe(hash2);
});

test('returns different hashes for different objects', () => {
  const obj1 = { a: 1, b: 'test', c: true };
  const obj2 = { a: 1, b: 'test', c: false };

  const hash1 = hashObject(hasher, obj1);
  const hash2 = hashObject(hasher, obj2);

  expect(hash1).not.toBe(hash2);
});
