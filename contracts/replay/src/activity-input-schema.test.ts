import { expect, test } from 'bun:test';
import { ActivityInputSchema } from './activity-input-schema';

function buildValidActivityInput() {
  return {
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
  };
}

test('it accepts a well-formed activity input', () => {
  const result = ActivityInputSchema.safeParse(buildValidActivityInput());

  expect(result.success).toBeTrue();
});

test('it rejects a failure action outside the enum', () => {
  const result = ActivityInputSchema.safeParse({
    ...buildValidActivityInput(),
    failureAction: 'retreat',
  });

  expect(result.success).toBeFalse();
});

test('it rejects an activity type other than world_map_encounter', () => {
  const result = ActivityInputSchema.safeParse({ ...buildValidActivityInput(), type: 'dungeon' });

  expect(result.success).toBeFalse();
});
