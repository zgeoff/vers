import { expect, test } from 'bun:test';
import { buildRollStream } from '@vers/roll-crypto';
import { rollEncounterFromStream } from './roll-encounter-from-stream';
import type { EncounterContent } from './types';

test('it reproduces the frozen golden encounter for a fixed seed', () => {
  const content: EncounterContent = {
    contentVersion: '1',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
      {
        id: 'placeholder-skirmisher',
        name: 'World Map Skirmisher',
        baseLevel: 1,
        baseLife: 20,
        baseXP: 8,
        attackMin: 1,
        attackMax: 4,
        attackSpeed: 0.7,
      },
    ],
    pools: [
      {
        id: 'default',
        entries: [
          { archetypeID: 'placeholder-brawler', weight: 1 },
          { archetypeID: 'placeholder-skirmisher', weight: 1 },
        ],
      },
    ],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const seed = Uint8Array.from({ length: 32 }, () => 22);
  const stream = buildRollStream(seed, 'test/domain');

  expect(rollEncounterFromStream(content, { difficulty: 1 }, stream)).toMatchInlineSnapshot(`
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
  const content: EncounterContent = {
    contentVersion: '1',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
    ],
    pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const first = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const second = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(rollEncounterFromStream(content, { difficulty: 1 }, first)).toStrictEqual(
    rollEncounterFromStream(content, { difficulty: 1 }, second),
  );
});

test('it rolls differently shaped encounters across a small set of seeds', () => {
  const content: EncounterContent = {
    contentVersion: '1',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
    ],
    pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const shapes = Array.from({ length: 5 }, (_, seedByte) => {
    const stream = buildRollStream(
      Uint8Array.from({ length: 32 }, () => seedByte),
      'test/domain',
    );

    const encounter = rollEncounterFromStream(content, { difficulty: 1 }, stream);

    return encounter.waves.map((wave) => wave.length);
  });

  const distinctShapeCount = new Set(shapes.map((shape) => shape.join(','))).size;

  expect(distinctShapeCount).toBeGreaterThan(1);
});

test('it scales enemy life, xp, and attack damage by the node difficulty', () => {
  const content: EncounterContent = {
    contentVersion: '1',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
    ],
    pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const unscaled = rollEncounterFromStream(
    content,
    { difficulty: 1 },
    buildRollStream(seed, 'test/domain'),
  );

  const scaled = rollEncounterFromStream(
    content,
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
  const content: EncounterContent = {
    contentVersion: '1',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
    ],
    pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const floored = rollEncounterFromStream(
    content,
    { difficulty: 0 },
    buildRollStream(seed, 'test/domain'),
  );

  const unscaled = rollEncounterFromStream(
    content,
    { difficulty: 1 },
    buildRollStream(seed, 'test/domain'),
  );

  expect(floored).toStrictEqual(unscaled);
});

test('it draws from the pool named by a stamped poolID', () => {
  const content: EncounterContent = {
    contentVersion: '2',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
      {
        id: 'placeholder-skirmisher',
        name: 'World Map Skirmisher',
        baseLevel: 1,
        baseLife: 20,
        baseXP: 8,
        attackMin: 1,
        attackMax: 4,
        attackSpeed: 0.7,
      },
      {
        id: 'placeholder-stalker',
        name: 'World Map Stalker',
        baseLevel: 1,
        baseLife: 24,
        baseXP: 10,
        attackMin: 2,
        attackMax: 5,
        attackSpeed: 0.9,
      },
    ],
    pools: [
      {
        id: 'brawler-den',
        entries: [
          { archetypeID: 'placeholder-brawler', weight: 1 },
          { archetypeID: 'placeholder-skirmisher', weight: 1 },
        ],
      },
      {
        id: 'skirmisher-flock',
        entries: [
          { archetypeID: 'placeholder-skirmisher', weight: 1 },
          { archetypeID: 'placeholder-stalker', weight: 1 },
        ],
      },
    ],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const encounter = rollEncounterFromStream(
    content,
    { difficulty: 1, poolID: 'skirmisher-flock' },
    buildRollStream(seed, 'test/domain'),
  );

  const archetypeNames = new Set(
    encounter.waves.flatMap((wave) => wave.map((enemy) => enemy.name)),
  );

  expect(archetypeNames).not.toContain('World Map Enemy');
});

test('it falls back to the first registered pool when poolID is absent', () => {
  const content: EncounterContent = {
    contentVersion: '2',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
      {
        id: 'placeholder-skirmisher',
        name: 'World Map Skirmisher',
        baseLevel: 1,
        baseLife: 20,
        baseXP: 8,
        attackMin: 1,
        attackMax: 4,
        attackSpeed: 0.7,
      },
    ],
    pools: [
      {
        id: 'brawler-den',
        entries: [
          { archetypeID: 'placeholder-brawler', weight: 1 },
          { archetypeID: 'placeholder-skirmisher', weight: 1 },
        ],
      },
    ],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const seed = Uint8Array.from({ length: 32 }, () => 22);

  const withoutPoolID = rollEncounterFromStream(
    content,
    { difficulty: 1 },
    buildRollStream(seed, 'test/domain'),
  );

  const withFirstPoolID = rollEncounterFromStream(
    content,
    { difficulty: 1, poolID: 'brawler-den' },
    buildRollStream(seed, 'test/domain'),
  );

  expect(withoutPoolID).toStrictEqual(withFirstPoolID);
});

test('it rejects a poolID naming no pool in the content', () => {
  const content: EncounterContent = {
    contentVersion: '1',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
    ],
    pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  };

  const seed = Uint8Array.from({ length: 32 }, () => 22);

  expect(() =>
    rollEncounterFromStream(
      content,
      { difficulty: 1, poolID: 'nonexistent-pool' },
      buildRollStream(seed, 'test/domain'),
    ),
  ).toThrowWithMessage(Error, /node poolID must reference a known pool/);
});
