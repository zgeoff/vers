import { produce } from 'immer';
import { createAvatarWeaponAttackBehaviour } from '../behaviours/avatar-weapon-attack';
import type {
  Avatar,
  AvatarBehaviour,
  AvatarBehaviourSnapshot,
  AvatarData,
  AvatarSnapshot,
  AvatarState,
  BehaviourID,
  CombatExecutor,
  SetEntityStateFn,
  SimulationContext,
} from '../types';
import { EntityStatus, EntityType, EquipmentSlot, LifecycleEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';
import { handleReceiveAvatarDamage } from './utils/handle-receive-avatar-damage';
import { rollAvatarAttackDamage } from './utils/roll-avatar-attack-damage';

const DEFAULT_BEHAVIOUR_FACTORIES = [createAvatarWeaponAttackBehaviour];

interface ResetConfig {
  readonly soft?: boolean;
}

export function createAvatar(data: AvatarData, ctx: SimulationContext): Avatar {
  const label = createLogLabel('avatar', data.id);
  let state = getInitialState(data);
  let currentLevel = data.level;

  const getSnapshot = (): AvatarSnapshot => {
    const behaviourState: AvatarBehaviourSnapshot = {};

    for (const behaviour of behaviours) {
      updateBehaviourSnapshot(behaviourState, behaviour.id, behaviour.getState());
    }

    const mainHandWeapon = data.paperdoll[EquipmentSlot.MainHand];

    const mainHandAttack = mainHandWeapon
      ? {
          maxDamage: mainHandWeapon.maxDamage,
          minDamage: mainHandWeapon.minDamage,
          speed: mainHandWeapon.speed,
        }
      : null;

    return {
      ...state,
      behaviours: behaviourState,
      id: data.id,
      isAlive: state.status === EntityStatus.Alive,
      level: currentLevel,
      mainHandAttack,
      name: data.name,
    };
  };

  const setState = (setStateFn: SetEntityStateFn<AvatarState>): void => {
    const nextState = produce(state, setStateFn);

    state = { ...nextState };
  };

  let behaviours: Array<AvatarBehaviour> = [];

  const handleTick = (combatExecutor: CombatExecutor): void => {
    for (const behaviour of behaviours) {
      const handler = behaviour.handlers[LifecycleEvent.OnTick];

      handler?.(avatar, combatExecutor, ctx);
    }
  };

  const registerBehaviour = (behaviour: AvatarBehaviour): void => {
    behaviours.push(behaviour);
  };

  const removeBehaviour = (id: BehaviourID): void => {
    behaviours = behaviours.filter((behaviour) => behaviour.id !== id);
  };

  const reset = (config: ResetConfig = {}): void => {
    if (config.soft !== true) {
      state = getInitialState(data);
    }

    for (const behaviour of behaviours) {
      const handler = behaviour.handlers[LifecycleEvent.Reset];

      handler?.(avatar, ctx);
    }
  };

  const avatar: Avatar = {
    // meta
    id: data.id,
    type: EntityType.Avatar,
    xp: data.xp,

    // getters
    get isAlive() {
      return state.status === EntityStatus.Alive;
    },
    get life() {
      return state.life;
    },
    get level() {
      return currentLevel;
    },
    get mainHandEquipment() {
      return data.paperdoll[EquipmentSlot.MainHand];
    },
    get status() {
      return state.status;
    },

    // core
    registerBehaviour,
    getSnapshot,
    handleTick,
    removeBehaviour,
    setState,

    // utils
    rollAttackDamage: () => rollAvatarAttackDamage(avatar, ctx),
    receiveDamage: (amount: number) => {
      handleReceiveAvatarDamage(amount, avatar);

      logger.debug(`${label} <-- ${amount} damage (${state.life} life remains)`);
    },
    reset,
    updateLevel: (level: number) => {
      currentLevel = level;
    },
  };

  DEFAULT_BEHAVIOUR_FACTORIES

    // create behaviours & register them if they're applicable
    .map((createBehaviour) => createBehaviour(avatar))
    .filter((behaviour) => behaviour.predicate(avatar))
    .forEach((behaviour) => {
      registerBehaviour(behaviour);
    });

  return avatar;
}

function getInitialState(data: AvatarData): AvatarState {
  return {
    life: data.life,
    maxLife: data.life,
    status: EntityStatus.Alive,
  };
}

/**
 * Writes a behaviour's state into the serializable snapshot under its id, keeping the id and value
 * types aligned.
 */
function updateBehaviourSnapshot<K extends BehaviourID>(
  state: AvatarBehaviourSnapshot,
  id: K,
  value: AvatarBehaviourSnapshot[K],
): void {
  state[id] = value;
}
