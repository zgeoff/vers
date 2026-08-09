import { expect, test } from 'bun:test';
import type { EncounterContent } from '@vers/game-utils';
import { EncounterContentSchema } from './encounter-content-schema';

const VALID_ENCOUNTER_CONTENT = {
  contentVersion: '1',
  archetypes: [
    {
      id: 'archetype-a',
      name: 'Archetype A',
      baseLevel: 1,
      baseLife: 10,
      baseXP: 5,
      attackMin: 1,
      attackMax: 2,
      attackSpeed: 0.5,
    },
    {
      id: 'archetype-b',
      name: 'Archetype B',
      baseLevel: 1,
      baseLife: 8,
      baseXP: 4,
      attackMin: 1,
      attackMax: 3,
      attackSpeed: 0.6,
    },
  ],
  pools: [
    {
      id: 'pool-a',
      entries: [
        { archetypeID: 'archetype-a', weight: 1 },
        { archetypeID: 'archetype-b', weight: 1 },
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

test('it accepts a coherent encounter content document', () => {
  const result = EncounterContentSchema.safeParse(VALID_ENCOUNTER_CONTENT);

  expect(result.success).toBeTrue();
});

test('it parses into the game type', () => {
  const encounter: EncounterContent = EncounterContentSchema.parse(VALID_ENCOUNTER_CONTENT);

  expect(encounter.contentVersion).toBe('1');
});

test('it rejects a pool entry naming an unregistered archetype', () => {
  const result = EncounterContentSchema.safeParse({
    ...VALID_ENCOUNTER_CONTENT,
    pools: [
      {
        id: 'pool-a',
        entries: [{ archetypeID: 'archetype-missing', weight: 1 }],
      },
    ],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 0, 'entries', 0, 'archetypeID'] }),
  );
});

test('it rejects an empty pools tuple', () => {
  const result = EncounterContentSchema.safeParse({ ...VALID_ENCOUNTER_CONTENT, pools: [] });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['pools'] }));
});

test('it rejects a pool with an empty entries tuple', () => {
  const result = EncounterContentSchema.safeParse({
    ...VALID_ENCOUNTER_CONTENT,
    pools: [{ id: 'pool-a', entries: [] }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 0, 'entries'] }),
  );
});
