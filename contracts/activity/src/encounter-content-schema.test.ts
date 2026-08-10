import { expect, test } from 'bun:test';
import type { EncounterContent } from '@vers/game-utils';
import { EncounterContentSchema } from './encounter-content-schema';

test('it accepts a coherent encounter content document', () => {
  const result = EncounterContentSchema.safeParse({
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
  });

  expect(result.success).toBeTrue();
});

test('it parses into the game type', () => {
  const encounter: EncounterContent = EncounterContentSchema.parse({
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
  });

  expect(encounter.contentVersion).toBe('1');
});

test('it rejects a pool entry naming an unregistered archetype', () => {
  const result = EncounterContentSchema.safeParse({
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
        entries: [{ archetypeID: 'archetype-missing', weight: 1 }],
      },
    ],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 0, 'entries', 0, 'archetypeID'] }),
  );
});

test('it rejects an empty pools tuple', () => {
  const result = EncounterContentSchema.safeParse({
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
    pools: [],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['pools'] }));
});

test('it rejects a pool with an empty entries tuple', () => {
  const result = EncounterContentSchema.safeParse({
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
    pools: [{ id: 'pool-a', entries: [] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 0, 'entries'] }),
  );
});

test('it rejects a fractional pool entry weight', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1.5 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 0, 'entries', 0, 'weight'] }),
  );
});

test('it rejects a zero pool entry weight', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 0 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 0, 'entries', 0, 'weight'] }),
  );
});

test('it rejects a fractional wave-count tuning value', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
    tuning: {
      waveCountMin: 2.5,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['tuning', 'waveCountMin'] }),
  );
});

test('it rejects a wave-count range whose min exceeds its max', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
    tuning: {
      waveCountMin: 7,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['tuning', 'waveCountMax'] }),
  );
});

test('it rejects a wave-size range whose min exceeds its max', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 7,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['tuning', 'waveSizeMax'] }),
  );
});

test('it rejects a zero difficulty scaling factor', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 0,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['tuning', 'difficultyScalingFactor'] }),
  );
});

test('it rejects duplicate archetype ids', () => {
  const result = EncounterContentSchema.safeParse({
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
        id: 'archetype-a',
        name: 'Archetype A Again',
        baseLevel: 1,
        baseLife: 8,
        baseXP: 4,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.6,
      },
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['archetypes', 1, 'id'] }),
  );
});

test('it rejects duplicate pool ids', () => {
  const result = EncounterContentSchema.safeParse({
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
    ],
    pools: [
      { id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] },
      { id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 2 }] },
    ],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['pools', 1, 'id'] }),
  );
});
