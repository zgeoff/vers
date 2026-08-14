import { expect, test } from 'bun:test';
import { readNodeSeed } from './read-node-seed';

test('it returns undefined for a node this device has never revealed', async () => {
  const seed = await readNodeSeed('read-node-seed-never-cached');

  expect(seed).toBeUndefined();
});
