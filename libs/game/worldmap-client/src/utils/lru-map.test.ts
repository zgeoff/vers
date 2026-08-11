import { expect, test } from 'bun:test';
import { LRUMap } from './lru-map';

test('it evicts the oldest entry once a set passes the capacity', () => {
  const map = new LRUMap<string, number>(2);

  map.set('a', 1);
  map.set('b', 2);
  map.set('c', 3);

  expect(map.get('a')).toBeUndefined();
  expect(map.get('b')).toBe(2);
  expect(map.get('c')).toBe(3);
});

test('it keeps its size at the capacity across a long insertion run', () => {
  const map = new LRUMap<string, number>(256);

  for (let index = 0; index < 1000; index++) {
    map.set(`key-${index}`, index);
  }

  expect(map.size).toBe(256);
  expect(map.get('key-743')).toBeUndefined();
  expect(map.get('key-744')).toBe(744);
  expect(map.get('key-999')).toBe(999);
});

test('it spares a recently read entry from eviction', () => {
  const map = new LRUMap<string, number>(2);

  map.set('a', 1);
  map.set('b', 2);
  map.get('a');
  map.set('c', 3);

  expect(map.get('a')).toBe(1);
  expect(map.get('b')).toBeUndefined();
});

test('it overwrites an existing key without evicting another entry', () => {
  const map = new LRUMap<string, number>(2);

  map.set('a', 1);
  map.set('b', 2);
  map.set('a', 3);

  expect(map.get('a')).toBe(3);
  expect(map.get('b')).toBe(2);
  expect(map.size).toBe(2);
});
