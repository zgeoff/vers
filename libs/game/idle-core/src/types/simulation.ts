import type { RNG } from '@vers/game-utils';
import type { XXHashAPI } from 'xxhash-wasm';
import type {
  Activity,
  ActivityAppState,
  ActivityCheckpoint,
  ActivityData,
  ActivityFailureAction,
} from './activity';
import type { CombatExecutor, CombatExecutorAppState } from './combat';
import type { Avatar, AvatarAppState, AvatarData } from './entities';

export interface SimulationAppState {
  readonly activity?: ActivityAppState;
  readonly avatar?: AvatarAppState;
  readonly combat?: CombatExecutorAppState;
  readonly failureAction: ActivityFailureAction;
}

export interface SimulationState {
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
  get state(): SimulationState;

  // utils
  addEventListener: (eventName: SimulationEventName, listener: SimulationListener) => void;
  getAppState: () => SimulationAppState;
  restartActivity: () => void;
  run: (time: number) => Promise<ActivityCheckpoint | null>;
  setFailureAction: (action: ActivityFailureAction) => void;
  startActivity: (avatarData: AvatarData, activityData: ActivityData) => void;
  stopActivity: () => Promise<void>;
}

export interface SimulationContext {
  get elapsed(): number;
  hasher: XXHashAPI;
  rng: RNG;
}

export type SimulationListener = (state: SimulationState) => void;
