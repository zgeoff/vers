import { buildStateFromSeed, createRNG } from '@vers/game-utils';
import { deepEqual } from 'fast-equals';
import invariant from 'tiny-invariant';
import { createAvatar } from '../entities/create-avatar';
import type {
  Activity,
  ActivityCheckpoint,
  ActivityCheckpointGenerator,
  ActivityInput,
  Avatar,
  AvatarData,
  CombatExecutor,
  LiveSimulation,
  Simulation,
  SimulationContext,
  SimulationEventName,
  SimulationListener,
} from '../types';
import { ActivityFailureAction } from '../types';
import { createActivity } from './create-activity';
import { createCombatExecutor } from './create-combat-executor';
import { simulateActivity } from './simulate-activity';
import { getSnapshot } from './utils/get-snapshot';

export function createSimulation(): Simulation {
  let _rng = createRNG(buildStateFromSeed(0));
  let _avatar: Avatar | null = null;
  let _activityData: ActivityInput | null = null;
  let _activity: Activity | null = null;
  let _combat: CombatExecutor | null = null;
  let _generator: ActivityCheckpointGenerator | null = null;
  let _done = false;
  let _elapsed = 0;
  let _failureAction = ActivityFailureAction.Abort;

  const ctx: SimulationContext = {
    get elapsed() {
      return _elapsed;
    },
    get rng() {
      return _rng;
    },
  };

  const state: LiveSimulation = {
    get activity() {
      return _activity;
    },
    get avatar() {
      return _avatar;
    },
    get combat() {
      return _combat;
    },
    get elapsed() {
      return _elapsed;
    },
    get failureAction() {
      return _failureAction;
    },
  };

  const listeners: Record<SimulationEventName, Array<SimulationListener>> = {
    restarted: [],
    started: [],
    stopped: [],
    updated: [],
  };

  const startActivity = async (avatarData: AvatarData, activityData: ActivityInput) => {
    const isSameActivity = _activityData?.id === activityData.id;
    const isSameAvatar = _avatar?.id === avatarData.id;

    if (isSameActivity && isSameAvatar) {
      return;
    }

    if (_generator) {
      await stopActivity();
    }

    _activityData = activityData;
    _failureAction = activityData.failureAction;
    _rng = createRNG(activityData.seed);
    _avatar = createAvatar(avatarData, ctx);
    _activity = createActivity(activityData, ctx);
    _combat = createCombatExecutor(_activity, _avatar, ctx);
    _generator = simulateActivity(_combat, _activity, _avatar, ctx);

    for (const listener of listeners.started) {
      listener(state);
    }
  };

  // cleans up our activity and notifies listeners
  const stopActivity = async () => {
    _activity = null;

    if (!_done) {
      // @ts-expect-error - we're not passing a return value during cleanup
      await _generator?.return();
    }

    _done = true;
    _generator = null;

    for (const listener of listeners.stopped) {
      listener(state);
    }
  };

  const restartActivity = () => {
    invariant(_activityData, 'activity data is required');
    invariant(_avatar, 'avatar is required');
    invariant(_combat, 'combat executor is required');

    _avatar.reset();

    _activity = createActivity(_activityData, ctx);
    _combat = createCombatExecutor(_activity, _avatar, ctx);
    _generator = simulateActivity(_combat, _activity, _avatar, ctx);

    for (const listener of listeners.restarted) {
      listener(state);
    }
  };

  const setFailureAction = (action: ActivityFailureAction) => {
    _failureAction = action;

    for (const listener of listeners.updated) {
      listener(state);
    }
  };

  const run = async (timestep: number): Promise<ActivityCheckpoint | null> => {
    if (!_generator) {
      return null;
    }

    const prevState = getSnapshot(state);

    const next = await _generator.next(timestep);

    _done = next.done ?? false;

    if (_done) {
      _generator = null;
    }

    const currentState = getSnapshot(state);

    if (!deepEqual(prevState, currentState)) {
      for (const listener of listeners.updated) {
        listener(state);
      }
    }

    _elapsed += timestep;

    return next.value;
  };

  return {
    // meta
    get rng() {
      return _rng;
    },

    // getters
    get activity() {
      return state.activity;
    },
    get avatar() {
      return state.avatar;
    },
    get ctx() {
      return ctx;
    },
    get elapsed(): number {
      return state.elapsed;
    },
    get failureAction(): ActivityFailureAction {
      return state.failureAction;
    },
    get rngState(): string {
      return _rng.getState();
    },
    get state() {
      return state;
    },

    // utils
    addEventListener: (eventName: SimulationEventName, listener: SimulationListener) => {
      listeners[eventName].push(listener);
    },
    getSnapshot: () => getSnapshot(state),
    restartActivity,
    run,
    setFailureAction,
    startActivity: (avatarData: AvatarData, activityData: ActivityInput) => {
      void startActivity(avatarData, activityData);
    },
    stopActivity,
  };
}
