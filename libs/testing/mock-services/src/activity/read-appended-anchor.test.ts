import { expect, test } from 'bun:test';
import * as db from '../db';
import { readAppendedAnchor } from './read-appended-anchor';

test('it derives the same genesis anchor at chain index 0 for a node never played', () => {
  const first = readAppendedAnchor({
    avatarID: 'avatar_fresh',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const second = readAppendedAnchor({
    avatarID: 'avatar_fresh',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const otherNode = readAppendedAnchor({
    avatarID: 'avatar_fresh',
    scopeID: '0_1',
    scopeType: 'world_map_node',
  });

  expect(first).toStrictEqual(second);
  expect(first.genesisSeed).toMatch(/^[0-9a-f]{32}$/u);
  expect(first.anchor).toStrictEqual({ chainIndex: 0, nextSeed: first.genesisSeed });
  expect(otherNode.genesisSeed).not.toBe(first.genesisSeed);
});

test('it moves the anchor to the tail of an activity that left active play', async () => {
  const activity = await db.activityCollection.create({
    appendedHead: 2,
    avatarID: 'avatar_played',
    scopeID: '0_0',
    status: 'stopped',
  });

  await db.checkpointCollection.create({
    activityID: activity.id,
    payload: {
      chainIndex: 2,
      entropySource: 'server-key',
      nextSeed: 'seed_after_two',
      seed: 'seed_after_one',
      time: 2000,
      type: 'progress',
    },
    version: 2,
  });

  const appended = readAppendedAnchor({
    avatarID: 'avatar_played',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(appended.anchor).toStrictEqual({ chainIndex: 2, nextSeed: 'seed_after_two' });
});

test('it leaves the anchor where it was for an active activity and for a started-only tail', async () => {
  const active = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: 'avatar_unmoved',
    scopeID: '0_0',
    status: 'active',
  });

  await db.checkpointCollection.create({
    activityID: active.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_active',
      seed: 'seed_active_start',
      time: 1000,
      type: 'progress',
    },
    version: 1,
  });

  const startedOnly = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: 'avatar_unmoved',
    scopeID: '0_0',
    status: 'stopped',
  });

  await db.checkpointCollection.create({
    activityID: startedOnly.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_started',
      seed: 'seed_started',
      time: 0,
      type: 'started',
    },
    version: 1,
  });

  const appended = readAppendedAnchor({
    avatarID: 'avatar_unmoved',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(appended.anchor).toStrictEqual({ chainIndex: 0, nextSeed: appended.genesisSeed });
});
