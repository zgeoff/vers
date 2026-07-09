export interface CombatExecutorAppState {
  readonly elapsed: number;
}

export interface CombatExecutor {
  // getters
  get elapsed(): number;

  // utils
  getAppState: () => CombatExecutorAppState;
  reset: () => void;
  run: (delta: number) => void;
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
