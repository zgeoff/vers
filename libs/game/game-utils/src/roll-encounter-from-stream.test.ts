import { expect, test } from 'bun:test';
import { buildRollStream } from '@vers/roll-crypto';
import { encounterContentV1 } from './content/encounter-content-v1';
import { encounterContentV2 } from './content/encounter-content-v2';
import { rollEncounterFromStream } from './roll-encounter-from-stream';

test('it reproduces the frozen golden encounter for a fixed seed', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);
  const stream = buildRollStream(seed, 'test/domain');

  expect(rollEncounterFromStream(encounterContentV1, { difficulty: 1 }, stream))
    .toMatchInlineSnapshot(`
    {
      "waves": [
        [
          {
            "level": 1,
            "life": 30,
            "name": "World Map Enemy",
            "primaryAttack": {
              "maxDamage": 3,
              "minDamage": 1,
              "speed": 0.5,
            },
            "xp": 10,
          },
          {
            "level": 1,
            "life": 20,
            "name": "World Map Skirmisher",
            "primaryAttack": {
              "maxDamage": 4,
              "minDamage": 1,
              "speed": 0.7,
            },
            "xp": 8,
          },
          {
            "level": 1,
            "life": 30,
            "name": "World Map Enemy",
            "primaryAttack": {
              "maxDamage": 3,
              "minDamage": 1,
              "speed": 0.5,
            },
            "xp": 10,
          },
        ],
        [
          {
            "level": 1,
            "life": 20,
            "name": "World Map Skirmisher",
            "primaryAttack": {
              "maxDamage": 4,
              "minDamage": 1,
              "speed": 0.7,
            },
            "xp": 8,
          },
          {
            "level": 1,
            "life": 20,
            "name": "World Map Skirmisher",
            "primaryAttack": {
              "maxDamage": 4,
              "minDamage": 1,
              "speed": 0.7,
            },
            "xp": 8,
          },
          {
            "level": 1,
            "life": 30,
            "name": "World Map Enemy",
            "primaryAttack": {
              "maxDamage": 3,
              "minDamage": 1,
              "speed": 0.5,
            },
            "xp": 10,
          },
        ],
        [
          {
            "level": 1,
            "life": 30,
            "name": "World Map Enemy",
            "primaryAttack": {
              "maxDamage": 3,
              "minDamage": 1,
              "speed": 0.5,
            },
            "xp": 10,
          },
          {
            "level": 1,
            "life": 30,
            "name": "World Map Enemy",
            "primaryAttack": {
              "maxDamage": 3,
              "minDamage": 1,
              "speed": 0.5,
            },
            "xp": 10,
          },
          {
            "level": 1,
            "life": 30,
            "name": "World Map Enemy",
            "primaryAttack": {
              "maxDamage": 3,
              "minDamage": 1,
              "speed": 0.5,
            },
            "xp": 10,
          },
          {
            "level": 1,
            "life": 20,
            "name": "World Map Skirmisher",
            "primaryAttack": {
              "maxDamage": 4,
              "minDamage": 1,
              "speed": 0.7,
            },
            "xp": 8,
          },
        ],
      ],
    }
  `);
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

test('it floors a zero-difficulty node to the same stats as difficulty one', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const floored = rollEncounterFromStream(
    encounterContentV1,
    { difficulty: 0 },
    buildRollStream(seed, 'test/domain'),
  );

  const unscaled = rollEncounterFromStream(
    encounterContentV1,
    { difficulty: 1 },
    buildRollStream(seed, 'test/domain'),
  );

  expect(floored).toStrictEqual(unscaled);
});

test('it draws from the pool named by a stamped poolID', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const encounter = rollEncounterFromStream(
    encounterContentV2,
    { difficulty: 1, poolID: 'skirmisher-flock' },
    buildRollStream(seed, 'test/domain'),
  );

  const archetypeNames = new Set(
    encounter.waves.flatMap((wave) => wave.map((enemy) => enemy.name)),
  );

  expect(archetypeNames).not.toContain('World Map Enemy');
});

test('it falls back to the first registered pool when poolID is absent', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const withoutPoolID = rollEncounterFromStream(
    encounterContentV2,
    { difficulty: 1 },
    buildRollStream(seed, 'test/domain'),
  );

  const withFirstPoolID = rollEncounterFromStream(
    encounterContentV2,
    { difficulty: 1, poolID: 'brawler-den' },
    buildRollStream(seed, 'test/domain'),
  );

  expect(withoutPoolID).toStrictEqual(withFirstPoolID);
});

test('it rejects a poolID naming no pool in the content', () => {
  const seed = Uint8Array.from({ length: 32 }, () => 22);

  expect(() =>
    rollEncounterFromStream(
      encounterContentV2,
      { difficulty: 1, poolID: 'nonexistent-pool' },
      buildRollStream(seed, 'test/domain'),
    ),
  ).toThrowWithMessage(Error, /node poolID must reference a known pool/);
});
