import type { EnemyData, EnemyGroup, EnemyGroupAppState } from './entities';

interface IActivityData {
  difficulty: number;
  failureAction: ActivityFailureAction;
  id: string;
  name: string;
  type: ActivityType;
}

export enum ActivityType {
  WorldNode = 'world_node',
}

export enum ActivityFailureAction {
  Abort = 'abort',
  Retry = 'retry',
}

export interface WorldNodeActivityData extends IActivityData {
  enemies: Array<EnemyData>;
  seed: number;
  type: ActivityType.WorldNode;
}

export type ActivityData = WorldNodeActivityData;

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

export interface ActivityAppState {
  readonly currentEnemyGroup: EnemyGroupAppState | null;
  readonly elapsed: number;
  readonly enemiesRemaining: number;
  readonly enemyGroups: Array<EnemyGroupAppState>;
  readonly enemyGroupsRemaining: number;
  readonly id: string;
  readonly levelUp: ActivityLevelUp | null;
  readonly name: string;
  readonly rewards: ActivityRewards;
}

export interface Activity {
  // meta
  readonly difficulty: number;
  readonly enemyGroups: Array<EnemyGroup>;
  readonly id: string;
  readonly name: string;
  readonly type: ActivityType;

  // getters
  get currentEnemyGroup(): EnemyGroup | null;
  get elapsed(): number;
  get isEnemyGroupsRemaining(): boolean;
  get levelUp(): ActivityLevelUp | null;
  get rewards(): ActivityRewards;

  // utils
  updateRewards: (delta: ActivityRewards) => void;
  elapseTime: (time: number) => void;
  getAppState: () => ActivityAppState;
  moveToNextEnemyGroup: () => void;
  setLevelUp: (levelUp: ActivityLevelUp) => void;
}

export type ActivityCheckpointGenerator = AsyncGenerator<
  ActivityCheckpoint | null,
  ActivityCheckpoint,
  number
>;

interface IActivityCheckpoint {
  readonly hash: string;
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
  readonly seed: number;
  readonly type: ActivityCheckpointType.Started;
}

export interface ActivityFailedCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: number;
  readonly type: ActivityCheckpointType.Failed;
}

export interface ActivityCompletedCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: number;
  readonly type: ActivityCheckpointType.Completed;
}

export interface ActivityProgressCheckpoint extends IActivityCheckpoint {
  readonly nextSeed: number;
  readonly type: ActivityCheckpointType.Progress;
}

export type ActivityCheckpoint =
  | ActivityCompletedCheckpoint
  | ActivityFailedCheckpoint
  | ActivityProgressCheckpoint
  | ActivityStartedCheckpoint;
