import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { createViewer } from '../create-viewer';
import { getRevealedNodes } from './get-revealed-nodes';

test('it reports the nodes the avatar has cleared', async () => {
  const viewer = await createViewer({ avatar: { completedNodeIDs: ['1_0', '0_1'] } });

  const result = await call(
    getRevealedNodes,
    {
      avatarID: viewer.avatar.id,
      viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
    },
    { context: { actingUserID: viewer.user.id } },
  );

  expect(result.completedNodeIDs).toStrictEqual(['1_0', '0_1']);
});

test('it reports no cleared nodes for an avatar that has cleared none', async () => {
  const viewer = await createViewer();

  const result = await call(
    getRevealedNodes,
    {
      avatarID: viewer.avatar.id,
      viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
    },
    { context: { actingUserID: viewer.user.id } },
  );

  expect(result.completedNodeIDs).toStrictEqual([]);
});
