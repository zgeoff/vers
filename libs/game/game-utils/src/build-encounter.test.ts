import { expect, test } from 'bun:test';
import { buildEncounter } from './build-encounter';
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

  const encounter = buildEncounter({ content, node: { difficulty: 1 }, seed: 'a'.repeat(32) });

  expect(encounter.waves.map((wave) => wave.length)).toMatchInlineSnapshot(`
    [
      5,
      5,
      5,
      6,
      6,
    ]
  `);

  expect(encounter.waves[0]?.[0]).toMatchInlineSnapshot(`
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
    }
  `);
});

test('it builds identical encounters from equal content, node, and seed', () => {
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

  const first = buildEncounter({ content, node: { difficulty: 1 }, seed: 'a'.repeat(32) });
  const second = buildEncounter({ content, node: { difficulty: 1 }, seed: 'a'.repeat(32) });

  expect(first).toStrictEqual(second);
});

test('it builds a differently shaped encounter for a different seed', () => {
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

  const first = buildEncounter({ content, node: { difficulty: 1 }, seed: 'a'.repeat(32) });
  const second = buildEncounter({ content, node: { difficulty: 1 }, seed: 'b'.repeat(32) });

  expect(first).not.toStrictEqual(second);
});
