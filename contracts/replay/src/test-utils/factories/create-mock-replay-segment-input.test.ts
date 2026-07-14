import { expect, test } from 'bun:test';
import { createMockReplaySegmentInput } from './create-mock-replay-segment-input';

test('it builds a request with a single enemy and no weapon equipped', () => {
  const input = createMockReplaySegmentInput();

  expect(input).toStrictEqual({
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
      id: expect.toBeString(),
      name: 'World Map Encounter',
      seed: expect.toBeString(),
      type: 'world_map_encounter',
    },
    avatar: {
      id: expect.toBeString(),
      level: 1,
      life: 200,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 0,
    },
    duration: 80_000,
    protocol: 1,
    simVersion: expect.toBeString(),
  });
});

test('it keeps explicit overrides', () => {
  const input = createMockReplaySegmentInput({ duration: 1000, simVersion: 'other-hash' });

  expect(input).toMatchObject({ duration: 1000, simVersion: 'other-hash' });
});
