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
  run: (time: number) => Promise<ActivityCheckpoint | null>;
  setFailureAction: (action: ActivityFailureAction) => void;
  startActivity: (avatarData: AvatarData, activityData: ActivityInput) => void;
  stopActivity: () => Promise<void>;
}

export interface SimulationContext {
  get elapsed(): number;
  rng: RNG;
}

export type SimulationListener = (state: LiveSimulation) => void;
