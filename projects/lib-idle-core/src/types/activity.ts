import type { EnemyData, EnemyGroup, EnemyGroupAppState } from './entities';

interface IActivityData {
  failureAction: ActivityFailureAction;
  id: string;
  name: string;
  type: ActivityType;
}

export enum ActivityType {
  AetherNode = 'aether_node',
}

export enum ActivityFailureAction {
  Abort = 'abort',
  Retry = 'retry',
}

export interface AetherNodeActivityData extends IActivityData {
  enemies: Array<EnemyData>;
  seed: number;
  type: ActivityType.AetherNode;
}

export type ActivityData = AetherNodeActivityData;

export interface ActivityAppState {
  readonly currentEnemyGroup: EnemyGroupAppState | null;
  readonly elapsed: number;
  readonly enemiesRemaining: number;
  readonly enemyGroups: Array<EnemyGroupAppState>;
  readonly enemyGroupsRemaining: number;
  readonly id: string;
  readonly name: string;
}

export interface Activity {
  // meta
  readonly enemyGroups: Array<EnemyGroup>;
  readonly id: string;
  readonly name: string;
  readonly type: ActivityType;

  // getters
  get currentEnemyGroup(): EnemyGroup | null;
  get elapsed(): number;
  get isEnemyGroupsRemaining(): boolean;

  // utils
  elapseTime: (time: number) => void;
  getAppState: () => ActivityAppState;
  moveToNextEnemyGroup: () => void;
}

export type ActivityCheckpointGenerator = AsyncGenerator<
  ActivityCheckpoint | null,
  ActivityCheckpoint,
  number
>;

interface IActivityCheckpoint {
  hash: string;
  time: number;
  type: ActivityCheckpointType;
}

export enum ActivityCheckpointType {
  Completed = 'completed',
  Failed = 'failed',
  Progress = 'progress',
  Started = 'started',
}

export interface ActivityStartedCheckpoint extends IActivityCheckpoint {
  seed: number;
  type: ActivityCheckpointType.Started;
}

export interface ActivityFailedCheckpoint extends IActivityCheckpoint {
  nextSeed: number;
  type: ActivityCheckpointType.Failed;
}

export interface ActivityCompletedCheckpoint extends IActivityCheckpoint {
  nextSeed: number;
  type: ActivityCheckpointType.Completed;
}

export interface ActivityProgressCheckpoint extends IActivityCheckpoint {
  nextSeed: number;
  type: ActivityCheckpointType.Progress;
}

export type ActivityCheckpoint =
  | ActivityCompletedCheckpoint
  | ActivityFailedCheckpoint
  | ActivityProgressCheckpoint
  | ActivityStartedCheckpoint;
