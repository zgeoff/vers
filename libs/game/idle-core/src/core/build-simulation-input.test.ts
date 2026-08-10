import { expect, test } from 'bun:test';
import { createMockEncounterContent } from '@vers/game-utils/test-utils';
import invariant from 'tiny-invariant';
import { buildLifeFromLevel } from '../progression';
import { createMockSimulationInputSource } from '../test-utils';
import { ActivityFailureAction, EquipmentSlot } from '../types';
import { buildSimulationInput } from './build-simulation-input';

test('it derives the activity id, avatar id, seed, and build snapshot from the source row', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 3, xp: 450 },
    contentVersion: '2',
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'aa'.repeat(16),
  };

  const result = buildSimulationInput(createMockEncounterContent({ contentVersion: '2' }), source);

  expect(result.activity.id).toBe('act_1');
  expect(result.activity.seed).toBe('aa'.repeat(16));
  expect(result.activity.failureAction).toBe(ActivityFailureAction.Abort);
  expect(result.avatar.id).toBe('avatar_1');
  expect(result.avatar.level).toBe(3);
  expect(result.avatar.xp).toBe(450);
});

test('it derives the avatar life from the build snapshot level', () => {
  const oneSource = createMockSimulationInputSource({ buildSnapshot: { level: 1, xp: 0 } });
  const levelledSource = createMockSimulationInputSource({ buildSnapshot: { level: 27, xp: 0 } });

  const levelOne = buildSimulationInput(
    createMockEncounterContent({ contentVersion: oneSource.contentVersion }),
    oneSource,
  );

  const levelled = buildSimulationInput(
    createMockEncounterContent({ contentVersion: levelledSource.contentVersion }),
    levelledSource,
  );

  expect(levelOne.avatar.life).toBe(buildLifeFromLevel(1));
  expect(levelled.avatar.life).toBe(buildLifeFromLevel(27));
  expect(levelled.avatar.life).toBeGreaterThan(levelOne.avatar.life);
});

test('it builds the same input for the same source row', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  };

  const content = createMockEncounterContent({ contentVersion: '2' });

  expect(buildSimulationInput(content, source)).toStrictEqual(
    buildSimulationInput(content, source),
  );
});

test('it derives the activity difficulty and encounter from the source encounter node', () => {
  const content = createMockEncounterContent({ contentVersion: '2' });

  const low = buildSimulationInput(content, {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  });

  const high = buildSimulationInput(content, {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    encounterNode: { difficulty: 5 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  });

  expect(low.activity.difficulty).toBe(1);
  expect(high.activity.difficulty).toBe(5);
  expect(low.activity.encounter).not.toStrictEqual(high.activity.encounter);
});

test('it floors a difficulty-0 source node to the same difficulty and encounter as difficulty one', () => {
  const content = createMockEncounterContent({ contentVersion: '2' });

  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    seed: 'bb'.repeat(16),
  };

  const floored = buildSimulationInput(content, {
    ...source,
    encounterNode: { difficulty: 0 },
    id: 'act_1',
  });

  const unscaled = buildSimulationInput(content, {
    ...source,
    encounterNode: { difficulty: 1 },
    id: 'act_1',
  });

  expect(floored.activity.difficulty).toBe(1);
  expect(floored.activity.encounter).toStrictEqual(unscaled.activity.encounter);
});

test('it returns a fresh encounter and weapon on every call, never a shared reference', () => {
  const content = createMockEncounterContent({ contentVersion: '2' });

  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  };

  const first = buildSimulationInput(content, source);
  const second = buildSimulationInput(content, source);
  const firstEnemy = first.activity.encounter.waves[0]?.[0];
  const secondEnemy = second.activity.encounter.waves[0]?.[0];

  invariant(firstEnemy && secondEnemy, 'derived encounters must open with a populated wave');

  expect(firstEnemy).not.toBe(secondEnemy);

  expect(first.avatar.paperdoll[EquipmentSlot.MainHand]).not.toBe(
    second.avatar.paperdoll[EquipmentSlot.MainHand],
  );
});

test('it rejects content whose version does not match the source', () => {
  const content = createMockEncounterContent({ contentVersion: 'other' });

  expect(() =>
    buildSimulationInput(content, {
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: 'nope',
      encounterNode: { difficulty: 1 },
      id: 'act_1',
      seed: 'dd'.repeat(16),
    }),
  ).toThrowWithMessage(Error, /content must match the source's pinned content version/);
});

test('it selects the pool named by a stamped poolID, and falls back to the first when absent', () => {
  const content = createMockEncounterContent({
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
      {
        id: 'skirmisher-flock',
        entries: [{ archetypeID: 'placeholder-skirmisher', weight: 1 }],
      },
    ],
  });

  const stamped = buildSimulationInput(
    content,
    createMockSimulationInputSource({
      contentVersion: '2',
      encounterNode: { difficulty: 1, poolID: 'skirmisher-flock' },
    }),
  );

  const absent = buildSimulationInput(
    content,
    createMockSimulationInputSource({
      contentVersion: '2',
      encounterNode: { difficulty: 1 },
    }),
  );

  const stampedNames = new Set(
    stamped.activity.encounter.waves.flatMap((wave) => wave.map((enemy) => enemy.name)),
  );

  const absentNames = new Set(
    absent.activity.encounter.waves.flatMap((wave) => wave.map((enemy) => enemy.name)),
  );

  expect(stampedNames).not.toContain('World Map Enemy');
  expect(absentNames).toContain('World Map Enemy');
});

test('it honors a failureAction override', () => {
  const result = buildSimulationInput(
    createMockEncounterContent({ contentVersion: '2' }),
    {
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '2',
      encounterNode: { difficulty: 1 },
      id: 'act_1',
      seed: 'cc'.repeat(16),
    },
    { failureAction: ActivityFailureAction.Retry },
  );

  expect(result.activity.failureAction).toBe(ActivityFailureAction.Retry);
});
