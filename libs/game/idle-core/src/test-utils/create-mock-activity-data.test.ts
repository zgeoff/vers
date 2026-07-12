import { expect, test } from 'bun:test';
import { ActivityFailureAction, ActivityType } from '../types';
import { createMockActivityData } from './create-mock-activity-data';
import { createMockEnemyData } from './create-mock-enemy-data';

test('it creates activity data with expected properties', () => {
  const activity = createMockActivityData();

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
    name: 'World Node',
    seed: expect.toBeNumber(),
    type: ActivityType.WorldNode,
  });
});

test('it creates activity data with custom properties', () => {
  const enemy = createMockEnemyData();

  const activity = createMockActivityData({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'custom-activity',
    name: 'Custom Activity',
    seed: 123,
    type: ActivityType.WorldNode,
  });

  expect(activity).toStrictEqual({
    difficulty: 1,
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'custom-activity',
    name: 'Custom Activity',
    seed: 123,
    type: ActivityType.WorldNode,
  });
});
