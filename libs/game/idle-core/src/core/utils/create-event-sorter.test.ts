import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import type { AvatarAttackEvent, EnemyAttackEvent } from '../../types';
import { CombatEventType } from '../../types';
import { createEventSorter } from './create-event-sorter';

test('it sorts events by time', () => {
  const ctx = createMockSimulationContext();
  const data = createMockAvatarData();
  const avatar = createAvatar(data, ctx);

  const event1: EnemyAttackEvent = {
    id: 'event-1',
    source: 'enemy-1',
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  const event2: EnemyAttackEvent = {
    id: 'event-2',
    source: 'enemy-2',
    time: 50,
    type: CombatEventType.EnemyAttack,
  };

  const events = [event1, event2];
  const sorter = createEventSorter(avatar);

  events.sort(sorter);

  expect(events).toStrictEqual([event2, event1]);
});

test('it prioritizes avatar events when time is equal', () => {
  const ctx = createMockSimulationContext();
  const data = createMockAvatarData();
  const avatar = createAvatar(data, ctx);

  const avatarEvent: AvatarAttackEvent = {
    id: 'event-1',
    source: avatar.id,
    time: 100,
    type: CombatEventType.AvatarAttack,
  };

  const enemyEvent2: EnemyAttackEvent = {
    id: 'event-2',
    source: 'enemy-1',
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  const enemyEvent3: EnemyAttackEvent = {
    id: 'event-3',
    source: 'enemy-2',
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  const events = [enemyEvent2, enemyEvent3, avatarEvent];
  const sorter = createEventSorter(avatar);

  events.sort(sorter);

  expect(events).toStrictEqual([avatarEvent, enemyEvent2, enemyEvent3]);
});

test('it breaks same-source ties by id, independent of scheduling order', () => {
  const ctx = createMockSimulationContext();
  const data = createMockAvatarData();
  const avatar = createAvatar(data, ctx);

  const enemyA: EnemyAttackEvent = {
    id: 'event-a',
    source: 'enemy-1',
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  const enemyB: EnemyAttackEvent = {
    id: 'event-b',
    source: 'enemy-1',
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  const sorter = createEventSorter(avatar);

  expect([enemyA, enemyB].toSorted(sorter)).toStrictEqual([enemyA, enemyB]);
  expect([enemyB, enemyA].toSorted(sorter)).toStrictEqual([enemyA, enemyB]);
});
