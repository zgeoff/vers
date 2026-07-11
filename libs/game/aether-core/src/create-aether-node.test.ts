import { expect, test } from 'bun:test';
import { createAetherNode } from './create-aether-node';

test('it returns an aether node with no connections', () => {
  const node = createAetherNode(0, 1);

  expect(node.connections).toStrictEqual([null, null, null, null]);
});

test('it generates an ID 6 avatars long', () => {
  const node = createAetherNode(0, 1);

  expect(node.id).toHaveLength(6);
});

test('it generates a random seed', () => {
  const node1 = createAetherNode(0, 1);
  const node2 = createAetherNode(0, 1);

  expect(node1.seed).not.toBe(node2.seed);
});
