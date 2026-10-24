import { expect, test } from 'bun:test';
import { ActivityFailureAction, ActivityType, EquipmentSlot } from '@vers/idle-core';
import { toWireReplaySegmentInput } from './to-wire-replay-segment-input';

test('it converts the engine activity and avatar to the wire shape', () => {
  const activity = {
    difficulty: 1,
    encounter: {
      waves: [
        [
          {
            level: 1,
            life: 30,
            name: 'Foe',
            primaryAttack: { maxDamage: 3, minDamage: 1, speedPerMille: 700 },
            xp: 10,
          },
        ],
      ],
    },
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
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'weapon_1',
        maxDamage: 20,
        minDamage: 10,
        name: 'Training Blade',
        speedPerMille: 800,
      },
    },
    xp: 120,
  };

  const job = toWireReplaySegmentInput({
    activity,
    avatar,
    duration: 80_000,
    simVersion: 'engine-hash-1',
  });

  expect(job).toStrictEqual({
    activity: {
      difficulty: 1,
      encounter: {
        waves: [
          [
            {
              level: 1,
              life: 30,
              name: 'Foe',
              primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.7 },
              xp: 10,
            },
          ],
        ],
      },
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
      paperdoll: {
        mainHand: {
          id: 'weapon_1',
          maxDamage: 20,
          minDamage: 10,
          name: 'Training Blade',
          speed: 0.8,
        },
      },
      xp: 120,
    },
    duration: 80_000,
    protocol: 1,
    simVersion: 'engine-hash-1',
  });
});

test('it sends an empty main hand as null', () => {
  const activity = {
    difficulty: 1,
    encounter: { waves: [] },
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

  const job = toWireReplaySegmentInput({
    activity,
    avatar,
    duration: 1000,
    simVersion: 'engine-hash-1',
  });

  expect(job.avatar.paperdoll.mainHand).toBeNull();
});

test('it converts an Abort failure action to its wire literal', () => {
  const activity = {
    difficulty: 1,
    encounter: { waves: [] },
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

  const job = toWireReplaySegmentInput({
    activity,
    avatar,
    duration: 1000,
    simVersion: 'engine-hash-1',
  });

  expect(job.activity.failureAction).toBe('abort');
});

test('it carries the expected checkpoint count and stopAtState when given', () => {
  const activity = {
    difficulty: 1,
    encounter: { waves: [] },
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

  const job = toWireReplaySegmentInput({
    activity,
    avatar,
    duration: 1000,
    simVersion: 'engine-hash-1',
    stopAtState: 'bb'.repeat(16),
    expectedCheckpointCount: 4,
  });

  expect(job.stopAtState).toBe('bb'.repeat(16));
  expect(job.expectedCheckpointCount).toBe(4);
});
