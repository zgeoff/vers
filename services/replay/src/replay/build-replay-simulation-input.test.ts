import { expect, test } from 'bun:test';
import { EquipmentSlot } from '@vers/idle-core';
import { buildReplaySimulationInput } from './build-replay-simulation-input';

test('it carries the activity id, avatar id, seed, and build snapshot into the engine input', () => {
  const result = buildReplaySimulationInput({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 3, xp: 450 },
    id: 'act_1',
    seed: 'aa'.repeat(16),
  });

  expect(result.activity.id).toBe('act_1');
  expect(result.activity.seed).toBe('aa'.repeat(16));
  expect(result.avatar.id).toBe('avatar_1');
  expect(result.avatar.level).toBe(3);
  expect(result.avatar.xp).toBe(450);
});

test('it builds the same input for the same activity source', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  };

  expect(buildReplaySimulationInput(source)).toStrictEqual(buildReplaySimulationInput(source));
});

test('it returns fresh enemy and weapon objects on every call, never a shared reference', () => {
  const source = {
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    id: 'act_1',
    seed: 'bb'.repeat(16),
  };

  const first = buildReplaySimulationInput(source);
  const second = buildReplaySimulationInput(source);

  expect(first.activity.enemies[0]).not.toBe(second.activity.enemies[0]);

  expect(first.avatar.paperdoll[EquipmentSlot.MainHand]).not.toBe(
    second.avatar.paperdoll[EquipmentSlot.MainHand],
  );
});
