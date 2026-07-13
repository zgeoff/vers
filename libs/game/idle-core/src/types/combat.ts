export interface ActivityExecutorSnapshot {
  readonly elapsed: number;
}

/**
 * The lifecycle every activity type's executor implements: report elapsed time,
 * project a serializable snapshot, reset for a fresh run, and advance by a delta.
 * Each activity type supplies its own executor — combat is the world map encounter's.
 */
export interface ActivityExecutor {
  // getters
  get elapsed(): number;

  // utils
  getSnapshot: () => ActivityExecutorSnapshot;
  reset: () => void;
  run: (delta: number) => void;
}

export type CombatExecutorSnapshot = ActivityExecutorSnapshot;

export interface CombatExecutor extends ActivityExecutor {
  // utils
  scheduleEvent: (event: CombatEvent) => void;
}

interface ICombatEvent {
  readonly id: string;
  readonly source: string;
  readonly time: number;
  readonly type: CombatEventType;
}

export enum CombatEventType {
  AvatarAttack = 'avatar_attack',
  EnemyAttack = 'enemy_attack',
}

export interface AvatarAttackEvent extends ICombatEvent {
  readonly type: CombatEventType.AvatarAttack;
}

export interface EnemyAttackEvent extends ICombatEvent {
  readonly type: CombatEventType.EnemyAttack;
}

export type CombatEvent = AvatarAttackEvent | EnemyAttackEvent;

export type AttackEvent = AvatarAttackEvent | EnemyAttackEvent;
