import { createId } from '@paralleldrive/cuid2';
import { produce } from 'immer';
import { createEnemyPrimaryAttackBehaviour } from '../behaviours/enemy-primary-attack';
import type {
  BehaviourID,
  CombatExecutor,
  Enemy,
  EnemyAppState,
  EnemyBehaviour,
  EnemyBehaviourAppState,
  EnemyData,
  EnemyState,
  SetEntityStateFn,
  SimulationContext,
} from '../types';
import { EntityStatus, EntityType, LifecycleEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';
import { calcEnemyAttackDamage } from './utils/calc-enemy-attack-damage';
import { handleReceiveEnemyDamage } from './utils/handle-receive-enemy-damage';

const DEFAULT_BEHAVIOUR_FACTORIES = [createEnemyPrimaryAttackBehaviour];

export function createEnemy(data: EnemyData, ctx: SimulationContext): Enemy {
  const id = createId();
  const label = createLogLabel('enemy', id);
  let state = getInitialState(data);

  const getAppState = (): EnemyAppState => {
    const behaviourState: EnemyBehaviourAppState = {};

    for (const behaviour of behaviours) {
      addBehaviourState(behaviourState, behaviour.id, behaviour.getState());
    }

    return {
      ...state,
      behaviours: behaviourState,
      id,
      isAlive: state.status === EntityStatus.Alive,
      level: data.level,
      name: data.name,
      primaryAttack: data.primaryAttack,
    };
  };

  const setState = (setStateFn: SetEntityStateFn<EnemyState>): void => {
    const nextState = produce(state, setStateFn);

    state = { ...nextState };
  };

  let behaviours: Array<EnemyBehaviour> = [];

  const handleTick = (combatExecutor: CombatExecutor): void => {
    for (const behaviour of behaviours) {
      const handler = behaviour.handlers[LifecycleEvent.OnTick];

      handler?.(enemy, combatExecutor, ctx);
    }
  };

  const addBehaviour = (behaviour: EnemyBehaviour): void => {
    behaviours.push(behaviour);
  };

  const removeBehaviour = (behaviourID: BehaviourID): void => {
    behaviours = behaviours.filter((behaviour) => behaviour.id !== behaviourID);
  };

  const enemy: Enemy = {
    // meta
    id,
    level: data.level,
    name: data.name,
    type: EntityType.Enemy,
    xp: data.xp,

    // getters
    get isAlive() {
      return state.status === EntityStatus.Alive;
    },
    get life() {
      return state.life;
    },
    get primaryAttack() {
      return data.primaryAttack;
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
    calcAttackDamage: () => calcEnemyAttackDamage(enemy, ctx),
    receiveDamage: (amount: number) => {
      handleReceiveEnemyDamage(amount, enemy);

      logger.debug(`${label} <-- ${amount} damage (${state.life} life remains)`);
    },
  };

  DEFAULT_BEHAVIOUR_FACTORIES

    // create behaviours & register them if they're applicable
    .map((createBehaviour) => createBehaviour(enemy))
    .filter((behaviour) => behaviour.predicate(enemy))
    .forEach((behaviour) => {
      addBehaviour(behaviour);
    });

  return enemy;
}

function getInitialState(data: EnemyData): EnemyState {
  return {
    life: data.life,
    maxLife: data.life,
    status: EntityStatus.Alive,
  };
}

// type safe util for adding our behaviour state to our serializable state
function addBehaviourState<K extends BehaviourID>(
  state: EnemyBehaviourAppState,
  id: K,
  value: EnemyBehaviourAppState[K],
): void {
  state[id] = value;
}
