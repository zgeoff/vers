import { expect, test } from 'bun:test';
import { buildEncounter } from './build-encounter';
import { encounterContentV1 } from './content/encounter-content-v1';

test('it reproduces the frozen golden encounter for a fixed seed', () => {
  const encounter = buildEncounter({
    content: encounterContentV1,
    node: { difficulty: 1 },
    seed: 'a'.repeat(32),
  });

  expect(encounter.waves.map((wave) => wave.length)).toStrictEqual([5, 5, 5, 6, 6]);

  expect(encounter.waves[0]?.[0]).toStrictEqual({
    level: 1,
    life: 20,
    name: 'World Map Skirmisher',
    primaryAttack: { maxDamage: 4, minDamage: 1, speed: 0.7 },
    xp: 8,
  });
});

test('it builds identical encounters from equal content, node, and seed', () => {
  const first = buildEncounter({
    content: encounterContentV1,
    node: { difficulty: 1 },
    seed: 'a'.repeat(32),
  });

  const second = buildEncounter({
    content: encounterContentV1,
    node: { difficulty: 1 },
    seed: 'a'.repeat(32),
  });

  expect(first).toStrictEqual(second);
});

test('it builds a differently shaped encounter for a different seed', () => {
  const first = buildEncounter({
    content: encounterContentV1,
    node: { difficulty: 1 },
    seed: 'a'.repeat(32),
  });

  const second = buildEncounter({
    content: encounterContentV1,
    node: { difficulty: 1 },
    seed: 'b'.repeat(32),
  });

  expect(first).not.toStrictEqual(second);
});
