import { createId } from '@paralleldrive/cuid2';
import { createEnemyPrimaryAttackBehaviour } from '../behaviours/enemy-primary-attack';
import type {
  BehaviourID,
  CombatExecutor,
  Enemy,
  EnemyBehaviour,
  EnemyBehaviourSnapshot,
  EnemyData,
  EnemySnapshot,
  EnemyState,
  SetEntityStateFn,
  SimulationContext,
} from '../types';
import { EntityStatus, EntityType, LifecycleEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';
import { handleReceiveEnemyDamage } from './utils/handle-receive-enemy-damage';
import { rollEnemyAttackDamage } from './utils/roll-enemy-attack-damage';

const DEFAULT_BEHAVIOUR_FACTORIES = [createEnemyPrimaryAttackBehaviour];

export function createEnemy(data: EnemyData, ctx: SimulationContext): Enemy {
  const id = createId();
  const label = createLogLabel('enemy', id);
  let state = getInitialState(data);

  const getSnapshot = (): EnemySnapshot => {
    const behaviourState: EnemyBehaviourSnapshot = {};

    for (const behaviour of behaviours) {
      updateBehaviourSnapshot(behaviourState, behaviour.id, behaviour.getState());
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
    const nextState = { ...state };

    setStateFn(nextState);

    state = nextState;
  };

  let behaviours: Array<EnemyBehaviour> = [];

  const handleTick = (combatExecutor: CombatExecutor): void => {
    for (const behaviour of behaviours) {
      const handler = behaviour.handlers[LifecycleEvent.OnTick];

      handler?.(enemy, combatExecutor, ctx);
    }
  };

  const registerBehaviour = (behaviour: EnemyBehaviour): void => {
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
    registerBehaviour,
    getSnapshot,
    handleTick,
    removeBehaviour,
    setState,

    // utils
    rollAttackDamage: () => rollEnemyAttackDamage(enemy, ctx),
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
      registerBehaviour(behaviour);
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

/**
 * Writes a behaviour's state into the serializable snapshot under its id, keeping the id and value
 * types aligned.
 */
function updateBehaviourSnapshot<K extends BehaviourID>(
  state: EnemyBehaviourSnapshot,
  id: K,
  value: EnemyBehaviourSnapshot[K],
): void {
  state[id] = value;
}
