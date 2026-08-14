import { expect, test } from 'bun:test';
import { readNodeSeed } from './read-node-seed';

test('it returns undefined for a node this device has never revealed for the avatar', async () => {
  const seed = await readNodeSeed('avatar-missing', 'read-node-seed-never-cached');

  expect(seed).toBeUndefined();
});
