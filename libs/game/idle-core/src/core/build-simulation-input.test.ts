import { expect, test } from 'bun:test';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { ActivityFailureAction, EquipmentSlot } from '../types';
import { buildSimulationInput } from './build-simulation-input';

test('it derives the activity id, avatar id, seed, and build snapshot from the source row', () => {
  const result = buildSimulationInput({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 3, xp: 450 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'aa'.repeat(16),
  });

  expect(result.activity.id).toBe('act_1');
  expect(result.activity.seed).toBe('aa'.repeat(16));
  expect(result.activity.failureAction).toBe(ActivityFailureAction.Abort);
  expect(result.avatar.id).toBe('avatar_1');
  expect(result.avatar.level).toBe(3);
  expect(result.avatar.xp).toBe(450);
});

test('it builds the same input for the same source row', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  };

  expect(buildSimulationInput(source)).toStrictEqual(buildSimulationInput(source));
});

test('it derives the activity difficulty and encounter from the source encounter node', () => {
  const low = buildSimulationInput({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  });

  const high = buildSimulationInput({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 5 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  });

  expect(low.activity.difficulty).toBe(1);
  expect(high.activity.difficulty).toBe(5);
  expect(low.activity.encounter).not.toStrictEqual(high.activity.encounter);
});

test('it floors a difficulty-0 source node to the same difficulty and encounter as difficulty one', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    seed: 'bb'.repeat(16),
  };

  const floored = buildSimulationInput({
    ...source,
    encounterNode: { difficulty: 0 },
    id: 'act_1',
  });

  const unscaled = buildSimulationInput({
    ...source,
    encounterNode: { difficulty: 1 },
    id: 'act_1',
  });

  expect(floored.activity.difficulty).toBe(1);
  expect(floored.activity.encounter).toStrictEqual(unscaled.activity.encounter);
});

test('it returns a fresh encounter and weapon on every call, never a shared reference', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 1 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  };

  const first = buildSimulationInput(source);
  const second = buildSimulationInput(source);
  const firstEnemy = first.activity.encounter.waves[0]?.[0];
  const secondEnemy = second.activity.encounter.waves[0]?.[0];

  invariant(firstEnemy && secondEnemy, 'derived encounters must open with a populated wave');
  expect(firstEnemy).not.toBe(secondEnemy);

  expect(first.avatar.paperdoll[EquipmentSlot.MainHand]).not.toBe(
    second.avatar.paperdoll[EquipmentSlot.MainHand],
  );
});

test('it rejects an unknown content version', () => {
  expect(() =>
    buildSimulationInput({
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: 'nope',
      encounterNode: { difficulty: 1 },
      id: 'act_1',
      seed: 'dd'.repeat(16),
    }),
  ).toThrowWithMessage(Error, /unknown content version: nope/);
});

test('it honors a failureAction override', () => {
  const result = buildSimulationInput(
    {
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: CURRENT_CONTENT_VERSION,
      encounterNode: { difficulty: 1 },
      id: 'act_1',
      seed: 'cc'.repeat(16),
    },
    { failureAction: ActivityFailureAction.Retry },
  );

  expect(result.activity.failureAction).toBe(ActivityFailureAction.Retry);
});
