import { produce } from 'immer';
import type {
  CombatExecutor,
  Enemy,
  EnemyPrimaryAttackBehaviour,
  EnemyPrimaryAttackBehaviourState,
  SetEntityStateFn,
} from '../../types';
import { BehaviourID, LifecycleEvent } from '../../types';
import { getInitialState } from './get-initial-state';
import { getNextAttackTime } from './get-next-attack-time';
import { handleTick } from './handle-tick';
import { predicate } from './predicate';

export function create(entity: Enemy): EnemyPrimaryAttackBehaviour {
  let state = getInitialState();

  const getState = (): EnemyPrimaryAttackBehaviourState => state;

  const setState = (setStateFn: SetEntityStateFn<EnemyPrimaryAttackBehaviourState>): void => {
    state = produce(state, setStateFn);
  };

  const handleReset = (): void => {
    state = getInitialState();
  };

  const behaviour: EnemyPrimaryAttackBehaviour = {
    // meta
    id: BehaviourID.EnemyPrimaryAttack,

    // getters
    get lastAttackTime(): number {
      return state.lastAttackTime;
    },
    get nextAttackTime(): number {
      return getNextAttackTime(entity, state);
    },
    get state(): EnemyPrimaryAttackBehaviourState {
      return state;
    },

    // handlers
    handlers: {
      [LifecycleEvent.OnTick]: (tickEntity: Enemy, executor: CombatExecutor) => {
        handleTick(tickEntity, behaviour, executor);
      },
      [LifecycleEvent.Reset]: () => {
        handleReset();
      },
    },
    predicate,

    // utils
    getState,
    setState,
  };

  return behaviour;
}
