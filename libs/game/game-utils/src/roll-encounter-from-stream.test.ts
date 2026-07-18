import { expect, test } from 'bun:test';
import { buildRollStream } from '@vers/roll-crypto';
import { encounterContentV1 } from './content/encounter-content-v1';
import { rollEncounterFromStream } from './roll-encounter-from-stream';

test('it reproduces the frozen golden encounter for a fixed seed', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);
  const stream = buildRollStream(seed, 'test/domain');

  expect(rollEncounterFromStream(encounterContentV1, { difficulty: 1 }, stream)).toStrictEqual({
    waves: [
      [
        {
          level: 1,
          life: 30,
          name: 'World Map Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
        {
          level: 1,
          life: 20,
          name: 'World Map Skirmisher',
          primaryAttack: { maxDamage: 4, minDamage: 1, speed: 0.7 },
          xp: 8,
        },
        {
          level: 1,
          life: 30,
          name: 'World Map Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
      [
        {
          level: 1,
          life: 20,
          name: 'World Map Skirmisher',
          primaryAttack: { maxDamage: 4, minDamage: 1, speed: 0.7 },
          xp: 8,
        },
        {
          level: 1,
          life: 20,
          name: 'World Map Skirmisher',
          primaryAttack: { maxDamage: 4, minDamage: 1, speed: 0.7 },
          xp: 8,
        },
        {
          level: 1,
          life: 30,
          name: 'World Map Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
      [
        {
          level: 1,
          life: 30,
          name: 'World Map Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
        {
          level: 1,
          life: 30,
          name: 'World Map Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
        {
          level: 1,
          life: 30,
          name: 'World Map Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
        {
          level: 1,
          life: 20,
          name: 'World Map Skirmisher',
          primaryAttack: { maxDamage: 4, minDamage: 1, speed: 0.7 },
          xp: 8,
        },
      ],
    ],
  });
});

test('it rolls identical encounters from equal content, node, and stream inputs', () => {
  const first = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const second = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(rollEncounterFromStream(encounterContentV1, { difficulty: 1 }, first)).toStrictEqual(
    rollEncounterFromStream(encounterContentV1, { difficulty: 1 }, second),
  );
});

test('it rolls differently shaped encounters across a small set of seeds', () => {
  const shapes = Array.from({ length: 5 }, (_, seedByte) => {
    const stream = buildRollStream(
      Uint8Array.from({ length: 32 }, () => seedByte),
      'test/domain',
    );

    const encounter = rollEncounterFromStream(encounterContentV1, { difficulty: 1 }, stream);

    return encounter.waves.map((wave) => wave.length);
  });

  const distinctShapeCount = new Set(shapes.map((shape) => shape.join(','))).size;

  expect(distinctShapeCount).toBeGreaterThan(1);
});

test('it scales enemy life, xp, and attack damage by the node difficulty', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const unscaled = rollEncounterFromStream(
    encounterContentV1,
    { difficulty: 1 },
    buildRollStream(seed, 'test/domain'),
  );

  const scaled = rollEncounterFromStream(
    encounterContentV1,
    { difficulty: 2 },
    buildRollStream(seed, 'test/domain'),
  );

  expect(scaled.waves[0]?.[0]).toStrictEqual({
    level: 1,
    life: 60,
    name: 'World Map Enemy',
    primaryAttack: { maxDamage: 6, minDamage: 2, speed: 0.5 },
    xp: 20,
  });

  expect(unscaled.waves[0]?.[0]).toStrictEqual({
    level: 1,
    life: 30,
    name: 'World Map Enemy',
    primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
    xp: 10,
  });
});

test('it rejects content with no pools', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const emptyContent = { ...encounterContentV1, pools: [] };

  expect(() => rollEncounterFromStream(emptyContent, { difficulty: 1 }, stream)).toThrowWithMessage(
    Error,
    /encounter content must define at least one pool/,
  );
});
