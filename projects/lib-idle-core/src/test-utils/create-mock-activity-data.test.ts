import { expect, test } from 'bun:test';
import { ActivityFailureAction, ActivityType } from '../types';
import { createMockActivityData } from './create-mock-activity-data';
import { createMockEnemyData } from './create-mock-enemy-data';

test('it creates activity data with expected properties', () => {
  const activity = createMockActivityData();

  expect(activity).toStrictEqual({
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
      },
    ],
    failureAction: ActivityFailureAction.Retry,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    name: 'Aether Node',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    seed: expect.any(Number),
    type: ActivityType.AetherNode,
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
    type: ActivityType.AetherNode,
  });

  expect(activity).toStrictEqual({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'custom-activity',
    name: 'Custom Activity',
    seed: 123,
    type: ActivityType.AetherNode,
  });
});
