import { expect, test } from 'bun:test';
import { ActivityFailureAction, ActivityType, EquipmentSlot } from '@vers/idle-core';
import { toWireReplaySegmentInput } from './to-wire-replay-segment-input';

test('it converts the engine activity and avatar to the wire shape', () => {
  const activity = {
    difficulty: 1,
    enemies: [
      {
        level: 1,
        life: 30,
        name: 'Foe',
        primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
        xp: 10,
      },
    ],
    failureAction: ActivityFailureAction.Retry,
    id: 'act_1',
    name: 'World Map Encounter',
    seed: 'aa'.repeat(16),
    type: ActivityType.WorldMapEncounter,
  };

  const avatar = {
    id: 'avatar_1',
    level: 2,
    life: 200,
    name: 'Test Avatar',
    paperdoll: { [EquipmentSlot.MainHand]: null },
    xp: 120,
  };

  const job = toWireReplaySegmentInput(activity, avatar, 80_000, 'engine-hash-1');

  expect(job).toStrictEqual({
    activity: {
      difficulty: 1,
      enemies: activity.enemies,
      failureAction: 'retry',
      id: 'act_1',
      name: 'World Map Encounter',
      seed: 'aa'.repeat(16),
      type: 'world_map_encounter',
    },
    avatar: {
      id: 'avatar_1',
      level: 2,
      life: 200,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 120,
    },
    duration: 80_000,
    protocol: 1,
    simVersion: 'engine-hash-1',
  });
});

test('it converts an Abort failure action to its wire literal', () => {
  const activity = {
    difficulty: 1,
    enemies: [],
    failureAction: ActivityFailureAction.Abort,
    id: 'act_1',
    name: 'World Map Encounter',
    seed: 'aa'.repeat(16),
    type: ActivityType.WorldMapEncounter,
  };

  const avatar = {
    id: 'avatar_1',
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: { [EquipmentSlot.MainHand]: null },
    xp: 0,
  };

  const job = toWireReplaySegmentInput(activity, avatar, 1000, 'engine-hash-1');

  expect(job.activity.failureAction).toBe('abort');
});
