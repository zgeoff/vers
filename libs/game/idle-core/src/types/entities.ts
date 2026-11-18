import type { AvatarBehaviour, Behaviour, BehaviourID, EnemyBehaviour } from './behaviour';
import type { CombatExecutor } from './combat';
import type { SetEntityStateFn } from './core';
import type { EquipmentSlot, EquipmentWeapon } from './equipment';

export interface AvatarData {
  id: string;
  level: number;
  life: number;
  name: string;
  xp: number;

  paperdoll: {
    [EquipmentSlot.MainHand]: EquipmentWeapon | null;
  };
}

export interface EnemyData {
  readonly level: number;
  readonly life: number;
  readonly name: string;
  readonly primaryAttack: AttackData;
  readonly xp: number;
}

export type HandleTickFn = (combatExecutor: CombatExecutor) => void;

interface IEntity<State extends object, EntitySnapshot extends object> {
  readonly id: string;
  readonly level: number;
  readonly type: EntityType;

  get isAlive(): boolean;
  get life(): number;
  get status(): EntityStatus;

  // oxlint-disable-next-line typescript/method-signature-style -- subtypes narrow the behaviour param; method syntax keeps the bivariant check that permits it
  registerBehaviour(behaviour: Behaviour): void;
  getSnapshot: () => EntitySnapshot;
  handleTick: (combatExecutor: CombatExecutor) => void;
  removeBehaviour: (id: BehaviourID) => void;
  setState: (setStateFn: SetEntityStateFn<State>) => void;

  receiveDamage: (amount: number) => void;
}

export type Entity = Avatar | Enemy;

interface ResetConfig {
  readonly soft?: boolean;
}

export interface AvatarState {
  readonly life: number;
  readonly maxLife: number;
  readonly status: EntityStatus;
}

export type AvatarBehaviourSnapshot = {
  [K in BehaviourID]?: ReturnType<Extract<AvatarBehaviour, { id: K }>['getState']>;
};

export interface AvatarSnapshot {
  readonly behaviours: AvatarBehaviourSnapshot;
  readonly id: string;
  readonly isAlive: boolean;
  readonly level: number;
  readonly life: number;
  readonly mainHandAttack: AttackData | null;
  readonly maxLife: number;
  readonly name: string;
  readonly status: EntityStatus;
}

export interface Avatar extends IEntity<AvatarState, AvatarSnapshot> {
  readonly type: EntityType.Avatar;
  readonly xp: number;

  get mainHandEquipment(): EquipmentWeapon | null;

  // oxlint-disable-next-line typescript/method-signature-style -- narrows the behaviour param; method syntax keeps the bivariant check that permits it
  registerBehaviour(behaviour: AvatarBehaviour): void;

  rollAttackDamage: () => number;
  reset: (config?: ResetConfig) => void;
  updateLevel: (level: number) => void;
}

export interface EnemyState {
  readonly life: number;
  readonly maxLife: number;
  readonly status: EntityStatus;
}

export type EnemyBehaviourSnapshot = {
  [K in BehaviourID]?: ReturnType<Extract<EnemyBehaviour, { id: K }>['getState']>;
};

export interface EnemySnapshot {
  readonly behaviours: EnemyBehaviourSnapshot;
  readonly id: string;
  readonly isAlive: boolean;
  readonly level: number;
  readonly life: number;
  readonly maxLife: number;
  readonly name: string;
  readonly primaryAttack: AttackData;
  readonly status: EntityStatus;
}

export interface Enemy extends IEntity<EnemyState, EnemySnapshot> {
  readonly name: string;
  readonly type: EntityType.Enemy;
  readonly xp: number;

  get primaryAttack(): AttackData;

  // oxlint-disable-next-line typescript/method-signature-style -- narrows the behaviour param; method syntax keeps the bivariant check that permits it
  registerBehaviour(behaviour: EnemyBehaviour): void;

  rollAttackDamage: () => number;
}

export enum EntityStatus {
  Alive = 'alive',
  Dead = 'dead',
}

export enum EntityType {
  Avatar = 'avatar',
  Enemy = 'enemy',
}

export interface AttackData {
  readonly maxDamage: number;
  readonly minDamage: number;
  readonly speedPerMille: number;
}

export interface WaveSnapshot {
  readonly enemies: ReadonlyArray<EnemySnapshot>;
  readonly id: string;
}

export interface Wave {
  readonly enemies: Array<Enemy>;
  readonly id: string;

  get nextLivingEnemy(): Enemy | null;
  get remaining(): number;

  getSnapshot: () => WaveSnapshot;
}
