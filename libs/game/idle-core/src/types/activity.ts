import type { EnemyData, Wave, WaveSnapshot } from './entities';

interface IActivityInput {
  difficulty: number;
  failureAction: ActivityFailureAction;
  id: string;
  name: string;
  type: ActivityType;
}

export enum ActivityType {
  WorldMapEncounter = 'world_map_encounter',
}

export enum ActivityFailureAction {
  Abort = 'abort',
  Retry = 'retry',
}

export interface WorldMapEncounterActivityInput extends IActivityInput {
  enemies: Array<EnemyData>;
  seed: string;
  type: ActivityType.WorldMapEncounter;
}

export type ActivityInput = WorldMapEncounterActivityInput;

/**
 * An open keyed map of signed reward deltas. Future keys are added as optional and never
 * repurposed, so an older reader that doesn't know a key can ignore it safely.
 */
export interface ActivityRewards {
  readonly xp: number;
}

/**
 * A level crossing recorded on the checkpoint (or activity attempt) that caused it.
 */
export interface ActivityLevelUp {
  readonly from: number;
  readonly to: number;
}

export interface ActivitySnapshot {
  readonly currentWave: WaveSnapshot | null;
  readonly elapsed: number;
  readonly enemiesRemaining: number;
  readonly id: string;
  readonly levelUp: ActivityLevelUp | null;
  readonly name: string;
  readonly rewards: ActivityRewards;
  readonly waves: ReadonlyArray<WaveSnapshot>;
  readonly wavesRemaining: number;
}

export interface Activity {
  // meta
  readonly difficulty: number;
  readonly id: string;
  readonly name: string;
  readonly type: ActivityType;
  readonly waves: Array<Wave>;

  // getters
  get currentWave(): Wave | null;
  get elapsed(): number;
  get isWavesRemaining(): boolean;
  get levelUp(): ActivityLevelUp | null;
  get rewards(): ActivityRewards;

  // utils
  updateRewards: (delta: ActivityRewards) => void;
  elapseTime: (time: number) => void;
  getSnapshot: () => ActivitySnapshot;
  moveToNextWave: () => void;
  setLevelUp: (levelUp: ActivityLevelUp) => void;
}

export type ActivityCheckpointGenerator = AsyncGenerator<
  ActivityCheckpoint | null,
  ActivityCheckpoint,
  number
>;

interface IActivityCheckpoint {
  readonly levelUp?: ActivityLevelUp;
  readonly rewards: ActivityRewards;
  readonly time: number;
  readonly type: ActivityCheckpointType;
}

export enum ActivityCheckpointType {
  Completed = 'completed',
  Failed = 'failed',
  Progress = 'progress',
  Started = 'started',
}

export interface ActivityStartedCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: string;
  readonly seed: string;
  readonly type: ActivityCheckpointType.Started;
}

export interface ActivityFailedCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: string;
  readonly type: ActivityCheckpointType.Failed;
}

export interface ActivityCompletedCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: string;
  readonly type: ActivityCheckpointType.Completed;
}

export interface ActivityProgressCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: string;
  readonly type: ActivityCheckpointType.Progress;
}

export type ActivityCheckpoint =
  | ActivityCompletedCheckpoint
  | ActivityFailedCheckpoint
  | ActivityProgressCheckpoint
  | ActivityStartedCheckpoint;
