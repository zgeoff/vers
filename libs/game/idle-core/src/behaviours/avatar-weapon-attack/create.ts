import { produce } from 'immer';
import type {
  Avatar,
  AvatarWeaponAttackBehaviour,
  AvatarWeaponAttackBehaviourState,
  CombatExecutor,
  SetEntityStateFn,
} from '../../types';
import { BehaviourID, LifecycleEvent } from '../../types';
import { getInitialState } from './get-initial-state';
import { getNextAttackTime } from './get-next-attack-time';
import { handleTick } from './handle-tick';
import { hasMainHandWeapon } from './has-main-hand-weapon';

export function create(entity: Avatar): AvatarWeaponAttackBehaviour {
  let state = getInitialState();
  const getState = (): AvatarWeaponAttackBehaviourState => state;

  const setState = (setStateFn: SetEntityStateFn<AvatarWeaponAttackBehaviourState>): void => {
    state = produce(state, setStateFn);
  };

  const handleReset = (): void => {
    state = getInitialState();
  };

  const behaviour: AvatarWeaponAttackBehaviour = {
    // meta
    id: BehaviourID.AvatarWeaponAttack,

    // getters
    get lastAttackTime(): number {
      return state.lastAttackTime;
    },
    get nextAttackTime(): number {
      return getNextAttackTime(entity, state);
    },
    get state(): AvatarWeaponAttackBehaviourState {
      return state;
    },

    // handlers
    handlers: {
      [LifecycleEvent.OnTick]: (tickEntity: Avatar, executor: CombatExecutor) => {
        handleTick(tickEntity, behaviour, executor);
      },
      [LifecycleEvent.Reset]: () => {
        handleReset();
      },
    },
    predicate: hasMainHandWeapon,

    // utils
    getState,
    setState,
  };

  return behaviour;
}
