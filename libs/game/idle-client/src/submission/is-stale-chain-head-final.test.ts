import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { isStaleChainHeadFinal } from './is-stale-chain-head-final';

test("it treats a refusal as final when the server's anchor sits behind the start and no earlier work waits", () => {
  const row = createMockActivityData({ id: 'act_rewound', startChainIndex: 9 });

  expect(
    isStaleChainHeadFinal({
      anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
      checkpoints: [],
      row,
      starts: [row],
      stopIntent: undefined,
    }),
  ).toBeTrue();
});

test("it keeps a refusal open while an admitted activity's checkpoints wait in the outbox", () => {
  const row = createMockActivityData({ id: 'act_waiting', startChainIndex: 9 });

  expect(
    isStaleChainHeadFinal({
      anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
      checkpoints: [
        { ...createMockCheckpointBatchEntry({ version: 1 }), activityID: 'act_admitted' },
      ],
      row,
      starts: [row],
      stopIntent: undefined,
    }),
  ).toBeFalse();
});

test("it keeps a refusal open while a stop for another of the avatar's activities waits", () => {
  const row = createMockActivityData({
    avatarID: 'avatar_stopping',
    id: 'act_after_stop',
    startChainIndex: 9,
  });

  expect(
    isStaleChainHeadFinal({
      anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
      checkpoints: [],
      row,
      starts: [row],
      stopIntent: { activityID: 'act_stopped_offline', avatarID: 'avatar_stopping' },
    }),
  ).toBeFalse();
});

test('it keeps a refusal open while an earlier pending start on the same node waits', () => {
  const earlier = createMockActivityData({
    id: 'act_earlier',
    predecessorActivityID: null,
    scopeID: '2_3',
    scopeType: 'world_map_node',
  });

  const between = createMockActivityData({
    id: 'act_between',
    predecessorActivityID: earlier.id,
    scopeID: '5_1',
    scopeType: 'world_map_node',
  });

  const row = createMockActivityData({
    id: 'act_refused',
    predecessorActivityID: between.id,
    scopeID: '2_3',
    scopeType: 'world_map_node',
    startChainIndex: 9,
  });

  expect(
    isStaleChainHeadFinal({
      anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
      checkpoints: [],
      row,
      starts: [earlier, between, row],
      stopIntent: undefined,
    }),
  ).toBeFalse();
});

test("it treats a refusal as final when the only other work is the start's own, a later start, or another node's", () => {
  const otherNode = createMockActivityData({
    id: 'act_other_node',
    predecessorActivityID: null,
    scopeID: '5_1',
    scopeType: 'world_map_node',
  });

  const row = createMockActivityData({
    avatarID: 'avatar_alone',
    id: 'act_refused',
    predecessorActivityID: otherNode.id,
    scopeID: '2_3',
    scopeType: 'world_map_node',
    startChainIndex: 9,
  });

  const later = createMockActivityData({
    id: 'act_later',
    predecessorActivityID: row.id,
    scopeID: '2_3',
    scopeType: 'world_map_node',
  });

  expect(
    isStaleChainHeadFinal({
      anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
      checkpoints: [
        { ...createMockCheckpointBatchEntry({ version: 1 }), activityID: row.id },
        { ...createMockCheckpointBatchEntry({ version: 1 }), activityID: later.id },
      ],
      row,
      starts: [otherNode, row, later],
      stopIntent: { activityID: row.id, avatarID: 'avatar_alone' },
    }),
  ).toBeTrue();
});

test("it ignores another avatar's waiting stop", () => {
  const row = createMockActivityData({
    avatarID: 'avatar_mine',
    id: 'act_mine',
    startChainIndex: 9,
  });

  expect(
    isStaleChainHeadFinal({
      anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
      checkpoints: [],
      row,
      starts: [row],
      stopIntent: { activityID: 'act_theirs', avatarID: 'avatar_theirs' },
    }),
  ).toBeTrue();
});

test.each([
  ['at', 9],
  ['past', 12],
])(
  "it treats a refusal as final when the server's anchor sits %s the start's index, whatever waits",
  (_label, chainIndex) => {
    const row = createMockActivityData({ id: 'act_overtaken', startChainIndex: 9 });

    expect(
      isStaleChainHeadFinal({
        anchor: { chainIndex, nextSeed: 'seed_server_other' },
        checkpoints: [
          { ...createMockCheckpointBatchEntry({ version: 1 }), activityID: 'act_admitted' },
        ],
        row,
        starts: [row],
        stopIntent: { activityID: 'act_admitted', avatarID: row.avatarID },
      }),
    ).toBeTrue();
  },
);
