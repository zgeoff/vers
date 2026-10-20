import { expect, test } from 'bun:test';
import { createLRUMap } from './create-lru-map';

test('it evicts the oldest entry once a set passes the capacity', () => {
  const map = createLRUMap<string, number>(2);

  map.set('a', 1);
  map.set('b', 2);
  map.set('c', 3);

  expect(map.findValue('a')).toBeUndefined();
  expect(map.findValue('b')).toBe(2);
  expect(map.findValue('c')).toBe(3);
});

test('it keeps its size at the capacity across a long insertion run', () => {
  const map = createLRUMap<string, number>(256);

  for (let index = 0; index < 1000; index++) {
    map.set(`key-${index}`, index);
  }

  expect(map.size).toBe(256);
  expect(map.findValue('key-743')).toBeUndefined();
  expect(map.findValue('key-744')).toBe(744);
  expect(map.findValue('key-999')).toBe(999);
});

test('it spares a recently read entry from eviction', () => {
  const map = createLRUMap<string, number>(2);

  map.set('a', 1);
  map.set('b', 2);
  map.findValue('a');
  map.set('c', 3);

  expect(map.findValue('a')).toBe(1);
  expect(map.findValue('b')).toBeUndefined();
});

test('it overwrites an existing key without evicting another entry', () => {
  const map = createLRUMap<string, number>(2);

  map.set('a', 1);
  map.set('b', 2);
  map.set('a', 3);

  expect(map.findValue('a')).toBe(3);
  expect(map.findValue('b')).toBe(2);
  expect(map.size).toBe(2);
});

test('it calls onEvict with the value and key a capacity eviction drops', () => {
  const evicted: Array<[string, number]> = [];

  const map = createLRUMap<string, number>(2, (value, key) => {
    evicted.push([key, value]);
  });

  map.set('a', 1);
  map.set('b', 2);
  map.set('c', 3);

  expect(evicted).toStrictEqual([['a', 1]]);
});

test('it never calls onEvict for an overwrite of an existing key', () => {
  const evicted: Array<[string, number]> = [];

  const map = createLRUMap<string, number>(2, (value, key) => {
    evicted.push([key, value]);
  });

  map.set('a', 1);
  map.set('a', 2);

  expect(evicted).toHaveLength(0);
});

test('it calls onEvict for every remaining entry when cleared', () => {
  const evicted: Array<[string, number]> = [];

  const map = createLRUMap<string, number>(4, (value, key) => {
    evicted.push([key, value]);
  });

  map.set('a', 1);
  map.set('b', 2);
  map.clear();

  expect(evicted).toIncludeSameMembers([
    ['a', 1],
    ['b', 2],
  ]);

  expect(map.size).toBe(0);
});

test('it calls onEvict when an entry is explicitly removed', () => {
  const evicted: Array<[string, number]> = [];

  const map = createLRUMap<string, number>(4, (value, key) => {
    evicted.push([key, value]);
  });

  map.set('a', 1);
  map.remove('a');

  expect(evicted).toStrictEqual([['a', 1]]);
});

test('it never calls onEvict for a remove that misses', () => {
  const evicted: Array<[string, number]> = [];

  const map = createLRUMap<string, number>(4, (value, key) => {
    evicted.push([key, value]);
  });

  map.remove('missing');

  expect(evicted).toHaveLength(0);
});
