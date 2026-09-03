import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createAvatar } from '../entities/create-avatar';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/factories/create-mock-simulation-context';
import type { EnemyAttackEvent, EquipmentWeapon } from '../types';
import { CombatEventType, EquipmentSlot } from '../types';
import { createActivity } from './create-activity';
import { createCombatExecutor } from './create-combat-executor';

test('it processes events', () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 100,
    minDamage: 100,
    name: 'Test Weapon',
    speed: 1,
  };

  const avatarData = createMockAvatarData({
    life: 100,
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
  });

  const enemyData = createMockEnemyData({
    life: 100,
    primaryAttack: {
      maxDamage: 40,
      minDamage: 40,
      speed: 1,
    },
  });

  const activityData = createMockActivityInput({
    encounter: { waves: [[enemyData, enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const wave = activity.currentWave;
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  // run the combat for 1s so that all entities should attack once
  combatExecutor.run(1000);

  // in this contrived example, the avatar should kill one enemy and be left with one enemy
  // and have received one enemy worth of damage
  expect(wave?.remaining).toBe(1);
  expect(avatar.life).toBe(60);
});

test('it processes a tick with a single scheduled event', () => {
  const enemyData = createMockEnemyData({
    life: 100,
    primaryAttack: {
      maxDamage: 40,
      minDamage: 40,
      speed: 1,
    },
  });

  // default avatar weapon speed (0.8, 1.25s interval) keeps the avatar from attacking within this
  // 1s tick, so only the enemy's attack is scheduled
  const avatarData = createMockAvatarData({ life: 200 });
  const activityData = createMockActivityInput({ encounter: { waves: [[enemyData]] } });
  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  combatExecutor.run(1000);

  expect(avatar.life).toBe(160);
});

test('it applies same-time enemy events in schedule order, not enemy array order', () => {
  // the lethal hit first kills the avatar before the weak enemy's damage roll draws from the rng;
  // the weak hit first draws before the death, so the two schedule orders consume a different
  // number of draws despite the same enemy array order
  const stateWhenLethalActsFirst = buildFinalRngState('lethal');
  const stateWhenWeakActsFirst = buildFinalRngState('weak');

  expect(stateWhenLethalActsFirst).not.toBe(stateWhenWeakActsFirst);
});

test('it returns the expected combat executor state for a client app', () => {
  const ctx = createMockSimulationContext();
  const activity = createActivity(createMockActivityInput(), ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);
  const state = combatExecutor.getSnapshot();

  expect(state).toStrictEqual({
    elapsed: 0,
  });
});

function buildFinalRngState(firstToAct: 'lethal' | 'weak'): string {
  const enemyDataLethal = createMockEnemyData({
    life: 100,
    primaryAttack: { maxDamage: 150, minDamage: 150, speed: 1 },
  });

  const enemyDataWeak = createMockEnemyData({
    life: 100,
    primaryAttack: { maxDamage: 10, minDamage: 1, speed: 1 },
  });

  const avatarData = createMockAvatarData({ life: 100 });

  const activityData = createMockActivityInput({
    encounter: { waves: [[enemyDataLethal, enemyDataWeak]] },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);
  const [lethalEnemy, weakEnemy] = activity.currentWave?.enemies ?? [];

  invariant(lethalEnemy && weakEnemy, 'both enemies are required');

  const lethalEvent: EnemyAttackEvent = {
    source: lethalEnemy.id,
    time: 0,
    type: CombatEventType.EnemyAttack,
  };

  const weakEvent: EnemyAttackEvent = {
    source: weakEnemy.id,
    time: 0,
    type: CombatEventType.EnemyAttack,
  };

  const orderedEvents =
    firstToAct === 'lethal' ? [lethalEvent, weakEvent] : [weakEvent, lethalEvent];

  orderedEvents.forEach((event) => {
    combatExecutor.scheduleEvent(event);
  });

  // a zero delta leaves both entities' own attack timers unready, so only our manually
  // scheduled events are applied this tick
  combatExecutor.run(0);

  return ctx.rng.getState();
}
