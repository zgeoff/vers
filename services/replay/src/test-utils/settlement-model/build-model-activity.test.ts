import { expect, test } from 'bun:test';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import { buildModelActivity } from './build-model-activity';

test('it reads XP, type and reward ordinals from the engine and nothing delivered yet', () => {
  const engineCheckpoint: ActivityCheckpoint = {
    nextSeed: 'seed-1',
    rewardSlots: [{ context: { nodeTier: 1 }, ordinal: 0 }],
    rewards: { xp: 12 },
    time: 1000,
    type: ActivityCheckpointType.Progress,
  };

  const activity = buildModelActivity({
    buildXP: 40,
    checkpoints: [
      {
        hash: 'hash-1',
        payload: {
          chainIndex: 6,
          entropySource: 'server-key',
          nextSeed: 'seed-1',
          rewards: { xp: 12 },
          seed: 'seed-0',
          time: 1000,
          type: 'progress',
        },
        prevHash: 'start-hash',
        version: 1,
      },
    ],
    engineCheckpoints: [engineCheckpoint],
    id: 'act_model',
    predecessorID: 'act_earlier',
    scopeID: '1_0',
    startChainIndex: 5,
  });

  expect(activity).toMatchObject({
    appendedHead: 0,
    buildXP: 40,
    checkpoints: [{ rewardOrdinals: [0], type: 'progress', xp: 12 }],
    id: 'act_model',
    predecessorID: 'act_earlier',
    scopeID: '1_0',
    settledXP: 0,
    startChainIndex: 5,
    status: 'active',
    tamperedVersion: null,
    verifiedHead: 0,
    writer: null,
  });
});

test('it forges a checkpoint by claiming one more XP and keeping its hash', () => {
  const activity = buildModelActivity({
    buildXP: 0,
    checkpoints: [
      {
        hash: 'hash-1',
        payload: {
          chainIndex: 1,
          entropySource: 'server-key',
          nextSeed: 'seed-1',
          seed: 'seed-0',
          time: 1000,
          type: 'progress',
        },
        prevHash: 'start-hash',
        version: 1,
      },
    ],
    engineCheckpoints: [
      {
        nextSeed: 'seed-1',
        rewardSlots: [],
        rewards: { xp: 12 },
        time: 1000,
        type: ActivityCheckpointType.Progress,
      },
    ],
    id: 'act_model',
    predecessorID: null,
    scopeID: '0_0',
    startChainIndex: 0,
  });

  expect(activity.checkpoints[0]?.forgedEntry).toStrictEqual({
    hash: 'hash-1',
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed-1',
      rewards: { xp: 13 },
      seed: 'seed-0',
      time: 1000,
      type: 'progress',
    },
    prevHash: 'start-hash',
    version: 1,
  });
});
