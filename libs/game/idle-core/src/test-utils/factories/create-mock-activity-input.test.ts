import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { ActivityFailureAction, ActivityType } from '../../types';
import { createMockActivityInput } from './create-mock-activity-input';
import { createMockEnemyData } from './create-mock-enemy-data';

test('it creates activity data with expected properties', () => {
  const activity = createMockActivityInput();

  expect(activity).toStrictEqual({
    difficulty: 1,
    enemies: [
      {
        level: 1,
        life: 30,
        name: 'Test Enemy',
        primaryAttack: {
          maxDamage: 3,
          minDamage: 1,
          speed: 0.5,
        },
        xp: 10,
      },
    ],
    failureAction: ActivityFailureAction.Retry,
    id: expect.toBeString(),
    name: 'World Map Encounter',
    seed: expect.toBeString(),
    type: ActivityType.WorldMapEncounter,
  });
});

test('it creates activity data with custom properties', () => {
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'custom-activity',
    name: 'Custom Activity',
    seed: buildStateFromSeed(123),
    type: ActivityType.WorldMapEncounter,
  });

  expect(activity).toStrictEqual({
    difficulty: 1,
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'custom-activity',
    name: 'Custom Activity',
    seed: buildStateFromSeed(123),
    type: ActivityType.WorldMapEncounter,
  });
});
