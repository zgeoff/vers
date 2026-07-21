import { expect, test } from 'bun:test';
import { createActivity } from '../../core/create-activity';
import { createCombatExecutor } from '../../core/create-combat-executor';
import { createAvatar } from '../../entities/create-avatar';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { BehaviourID, EquipmentSlot } from '../../types';
import { create } from './create';
import { handleTick } from './handle-tick';

test('it schedules attacks on the tick event', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 10,
        name: 'Test Weapon',
        speed: 1, // 1000ms interval
      },
    },
  });

  const enemyData = createMockEnemyData({ life: 10 });
  const activityData = createMockActivityInput({ encounter: { waves: [[enemyData]] } });
  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);
  const wave = activity.currentWave;

  // we need to remove the behaviour from the avatar as it's already added
  // by default and would get ran when we run our combat executor
  avatar.removeBehaviour(BehaviourID.AvatarWeaponAttack);

  const behaviour = create(avatar);

  combatExecutor.run(1000);

  handleTick(avatar, behaviour, combatExecutor);

  expect(wave?.remaining).toBe(1);

  combatExecutor.run(1);

  handleTick(avatar, behaviour, combatExecutor);

  expect(wave?.remaining).toBe(0);
  expect(behaviour.state.lastAttackTime).toBe(1000);
});

test('it schedules multiple attacks for high APS weapons', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 10,
        name: 'Test Weapon',
        speed: 2, // 500ms interval
      },
    },
  });

  const enemyData = createMockEnemyData({ life: 10 });

  const activityData = createMockActivityInput({
    encounter: { waves: [Array.from({ length: 5 }, () => enemyData)] },
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);
  const wave = activity.currentWave;

  // we need to remove the behaviour from the avatar as it's already added
  // by default and would get ran when we run our combat executor
  avatar.removeBehaviour(BehaviourID.AvatarWeaponAttack);

  const behaviour = create(avatar);

  combatExecutor.run(2500);

  handleTick(avatar, behaviour, combatExecutor);

  combatExecutor.run(1);

  expect(wave?.remaining).toBe(0);
  expect(behaviour.state.lastAttackTime).toBe(2500);
});
