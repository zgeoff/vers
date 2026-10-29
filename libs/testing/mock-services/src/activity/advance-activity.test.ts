import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { buildOfflineActivityStartSubmission } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createViewer } from '../create-viewer';
import { advanceActivity } from './advance-activity';
import { readAppendedAnchor } from './read-appended-anchor';

test('it admits a start on the node’s appended anchor that carries the avatar’s build', async () => {
  const viewer = await createViewer({ avatar: { level: 1, xp: 0 } });

  const appended = readAppendedAnchor({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: 1, xp: 0 },
    id: 'act_mock_admitted',
    scopeID: '0_0',
    seed: appended.anchor.nextSeed,
    startChainIndex: appended.anchor.chainIndex,
    startKey: 'start_key_mock_admitted',
  });

  const result = await call(
    advanceActivity,
    {
      activityID: row.id,
      activityStart: buildOfflineActivityStartSubmission(row),
      continuations: [],
      expectedHead: 0,
    },
    { context: { actingUserID: viewer.user.id } },
  );

  expect(result.activity.id).toBe(row.id);
});

test('it refuses a start off the node’s appended anchor as a stale chain head, carrying the anchor', async () => {
  const viewer = await createViewer({ avatar: { level: 1, xp: 0 } });

  const appended = readAppendedAnchor({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: 1, xp: 0 },
    id: 'act_mock_stale',
    scopeID: '0_0',
    seed: appended.anchor.nextSeed,
    startChainIndex: 1,
    startKey: 'start_key_mock_stale',
  });

  const refused = call(
    advanceActivity,
    {
      activityID: row.id,
      activityStart: buildOfflineActivityStartSubmission(row),
      continuations: [],
      expectedHead: 0,
    },
    { context: { actingUserID: viewer.user.id } },
  );

  expect(refused).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { anchor: appended.anchor, reason: 'stale-chain-head' },
  });
});

test('it refuses a start whose build differs from the avatar’s optimistic build', async () => {
  const viewer = await createViewer({ avatar: { level: 1, xp: 0 } });

  const appended = readAppendedAnchor({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: 1, xp: 12 },
    id: 'act_mock_build',
    scopeID: '0_0',
    seed: appended.anchor.nextSeed,
    startChainIndex: appended.anchor.chainIndex,
    startKey: 'start_key_mock_build',
  });

  const refused = call(
    advanceActivity,
    {
      activityID: row.id,
      activityStart: buildOfflineActivityStartSubmission(row),
      continuations: [],
      expectedHead: 0,
    },
    { context: { actingUserID: viewer.user.id } },
  );

  expect(refused).rejects.toMatchObject({
    code: 'CHECKPOINT_INVALID',
    data: { reason: 'build-snapshot-mismatch' },
  });
});
