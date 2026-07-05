export interface CombatExecutorAppState {
  elapsed: number;
}

export interface CombatExecutor {
  // getters
  get elapsed(): number;

  // utils
  getAppState: () => CombatExecutorAppState;
  reset: () => void;
  run: (delta: number) => void;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  scheduleEvent: (event: CombatEvent) => void;
}

interface ICombatEvent {
  id: string;
  source: string;
  time: number;
  type: CombatEventType;
}

export enum CombatEventType {
  AvatarAttack = 'avatar_attack',
  EnemyAttack = 'enemy_attack',
}

export interface AvatarAttackEvent extends ICombatEvent {
  type: CombatEventType.AvatarAttack;
}

export interface EnemyAttackEvent extends ICombatEvent {
  type: CombatEventType.EnemyAttack;
}

export type CombatEvent = AvatarAttackEvent | EnemyAttackEvent;

export type AttackEvent = AvatarAttackEvent | EnemyAttackEvent;
