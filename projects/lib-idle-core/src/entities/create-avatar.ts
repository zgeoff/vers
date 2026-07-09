import { produce } from 'immer';
import { createAvatarWeaponAttackBehaviour } from '../behaviours/avatar-weapon-attack';
import type {
  Avatar,
  AvatarAppState,
  AvatarBehaviour,
  AvatarBehaviourAppState,
  AvatarData,
  AvatarState,
  BehaviourID,
  CombatExecutor,
  SetEntityStateFn,
  SimulationContext,
} from '../types';
import { EntityStatus, EntityType, EquipmentSlot, LifecycleEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';
import { calcAvatarAttackDamage } from './utils/calc-avatar-attack-damage';
import { handleReceiveAvatarDamage } from './utils/handle-receive-avatar-damage';

const DEFAULT_BEHAVIOUR_FACTORIES = [createAvatarWeaponAttackBehaviour];

interface ResetConfig {
  soft?: boolean;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createAvatar(data: AvatarData, ctx: SimulationContext): Avatar {
  const label = createLogLabel('avatar', data.id);

  let state = getInitialState(data);

  // TODO: pull this out into a util
  const getAppState = (): AvatarAppState => {
    const behaviourState: AvatarBehaviourAppState = {};

    for (const behaviour of behaviours) {
      addBehaviourState(behaviourState, behaviour.id, behaviour.getState());
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
      class: data.class,
      id: data.id,
      isAlive: state.status === EntityStatus.Alive,
      level: data.level,
      mainHandAttack,
      name: data.name,
    };
  };

  const setState = (setStateFn: SetEntityStateFn<AvatarState>): void => {
    const nextState = produce(state, setStateFn);

    state = { ...nextState };
  };

  let behaviours: Array<AvatarBehaviour> = [];

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const handleTick = (combatExecutor: CombatExecutor): void => {
    for (const behaviour of behaviours) {
      const handler = behaviour.handlers[LifecycleEvent.OnTick];

      handler?.(avatar, combatExecutor, ctx);
    }
  };

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const addBehaviour = (behaviour: AvatarBehaviour): void => {
    behaviours.push(behaviour);
  };

  const removeBehaviour = (id: BehaviourID): void => {
    behaviours = behaviours.filter((behaviour) => behaviour.id !== id);
  };

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const reset = (config: ResetConfig = {}): void => {
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    if (!config.soft) {
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
    level: data.level,
    type: EntityType.Avatar,

    // getters
    get isAlive() {
      return state.status === EntityStatus.Alive;
    },
    get life() {
      return state.life;
    },
    get mainHandEquipment() {
      return data.paperdoll[EquipmentSlot.MainHand];
    },
    get status() {
      return state.status;
    },

    // core
    addBehaviour,
    getAppState,
    handleTick,
    removeBehaviour,
    setState,

    // utils
    calcAttackDamage: () => calcAvatarAttackDamage(avatar, ctx),
    receiveDamage: (amount: number) => {
      handleReceiveAvatarDamage(amount, avatar);

      logger.debug(`${label} <-- ${amount} damage (${state.life} life remains)`);
    },
    reset,
  };

  DEFAULT_BEHAVIOUR_FACTORIES

    // create behaviours & register them if they're applicable
    .map((createBehaviour) => createBehaviour(avatar))
    .filter((behaviour) => behaviour.predicate(avatar))
    // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
    .map((behaviour) => addBehaviour(behaviour));

  return avatar;
}

export function getInitialState(data: AvatarData): AvatarState {
  return {
    life: data.life,
    maxLife: data.life,
    status: EntityStatus.Alive,
  };
}

// type safe util for adding our behaviour state to our serializable state
function addBehaviourState<K extends BehaviourID>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  state: AvatarBehaviourAppState,
  id: K,
  value: AvatarBehaviourAppState[K],
): void {
  state[id] = value;
}
