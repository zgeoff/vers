import { expect, test } from 'bun:test';
import { ReplaySegmentInputSchema } from './replay-segment-input-schema';

test('it accepts a well-formed replay segment input', () => {
  const result = ReplaySegmentInputSchema.safeParse({
    activity: {
      difficulty: 1,
      enemies: [
        {
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
      failureAction: 'retry',
      id: 'world_map_encounter_1',
      name: 'World Map Encounter',
      seed: '63298078c2177576c07e0321584c2a05',
      type: 'world_map_encounter',
    },
    avatar: {
      id: 'avatar_1',
      level: 1,
      life: 50,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 0,
    },
    duration: 60_000,
    protocol: 1,
    simVersion: 'engine-hash-1',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a protocol other than 1', () => {
  const result = ReplaySegmentInputSchema.safeParse({
    activity: {
      difficulty: 1,
      enemies: [
        {
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
      failureAction: 'retry',
      id: 'world_map_encounter_1',
      name: 'World Map Encounter',
      seed: '63298078c2177576c07e0321584c2a05',
      type: 'world_map_encounter',
    },
    avatar: {
      id: 'avatar_1',
      level: 1,
      life: 50,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 0,
    },
    duration: 60_000,
    protocol: 2,
    simVersion: 'engine-hash-1',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['protocol'] }));
});

test('it accepts an expected checkpoint count', () => {
  const result = ReplaySegmentInputSchema.safeParse({
    activity: {
      difficulty: 1,
      enemies: [
        {
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
      failureAction: 'retry',
      id: 'world_map_encounter_1',
      name: 'World Map Encounter',
      seed: '63298078c2177576c07e0321584c2a05',
      type: 'world_map_encounter',
    },
    avatar: {
      id: 'avatar_1',
      level: 1,
      life: 50,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 0,
    },
    duration: 60_000,
    expectedCheckpointCount: 3,
    protocol: 1,
    simVersion: 'engine-hash-1',
  });

  expect(result.success).toBeTrue();
});

test('it rejects an input missing the sim version', () => {
  const result = ReplaySegmentInputSchema.safeParse({
    activity: {
      difficulty: 1,
      enemies: [
        {
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
      failureAction: 'retry',
      id: 'world_map_encounter_1',
      name: 'World Map Encounter',
      seed: '63298078c2177576c07e0321584c2a05',
      type: 'world_map_encounter',
    },
    avatar: {
      id: 'avatar_1',
      level: 1,
      life: 50,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 0,
    },
    duration: 60_000,
    protocol: 1,
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['simVersion'] }),
  );
});
