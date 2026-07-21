import type { RNG } from '@vers/game-utils';
import type {
  Activity,
  ActivityCheckpoint,
  ActivityFailureAction,
  ActivityInput,
  ActivitySnapshot,
} from './activity';
import type { CombatExecutor, CombatExecutorSnapshot } from './combat';
import type { Avatar, AvatarData, AvatarSnapshot } from './entities';

export interface SimulationSnapshot {
  readonly activity?: ActivitySnapshot;
  readonly avatar?: AvatarSnapshot;
  readonly combat?: CombatExecutorSnapshot;
  readonly failureAction: ActivityFailureAction;
}

export interface LiveSimulation {
  readonly activity: Activity | null;
  readonly avatar: Avatar | null;
  readonly combat: CombatExecutor | null;
  readonly elapsed: number;
  readonly failureAction: ActivityFailureAction;
}

export type SimulationEventName = 'restarted' | 'started' | 'stopped' | 'updated';

export interface Simulation {
  // meta
  readonly rng: RNG;

  // getters
  get activity(): Activity | null;
  get avatar(): Avatar | null;
  get ctx(): SimulationContext;
  get elapsed(): number;
  get failureAction(): ActivityFailureAction;
  get rngState(): string;
  get state(): LiveSimulation;

  // utils
  addEventListener: (eventName: SimulationEventName, listener: SimulationListener) => void;
  getSnapshot: () => SimulationSnapshot;
  restartActivity: () => void;
  run: (time: number) => ActivityCheckpoint | null;
  setFailureAction: (action: ActivityFailureAction) => void;
  startActivity: (avatarData: AvatarData, activityData: ActivityInput) => void;
  stopActivity: () => void;
}

export interface SimulationContext {
  get elapsed(): number;
  rng: RNG;
}

export type SimulationListener = (state: LiveSimulation) => void;

/**
 * One `advanceToDuration` call's outcome: the checkpoints newly emitted by that call, and whether
 * `duration` was exhausted before `expectedCheckpointCount` was reached — a caller sizing
 * `duration` from claimed stream time treats that as an operational bound trip, never as
 * divergence.
 */
export interface SimulationAdvanceResult {
  readonly checkpoints: Array<ActivityCheckpoint>;
  readonly haltedOnDurationCap: boolean;
}

/**
 * A resumable driver over one live simulation, started once on `(activity, avatar)`. Repeated
 * `advanceToDuration` calls with a monotonically increasing `duration` tick the same simulation
 * forward and return only the checkpoints newly emitted by that call — the simulation is never
 * restarted or stopped between calls, so a stream replayed in several advances reproduces the same
 * checkpoints as one call for the same final duration. `expectedCheckpointCount`, when given, is
 * the primary halt: the call stops once it has emitted that many checkpoints, `duration` is only
 * the safety cap behind it, and `stopAtState` is consulted only after this call has emitted at
 * least one checkpoint — never before the first tick, so a resume point with zero entropy
 * consumed still emits its own checkpoint rather than halting on it immediately. A call after the
 * simulation's own terminal (an aborted failure) returns no checkpoints rather than looping.
 */
export interface SimulationDriver {
  advanceToDuration: (
    duration: number,
    stopAtState?: string,
    expectedCheckpointCount?: number,
  ) => Promise<SimulationAdvanceResult>;
  get elapsed(): number;
  get rngState(): string;
  stop: () => Promise<void>;
}
