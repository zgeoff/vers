import type { AvatarBehaviour, Behaviour, BehaviourID, EnemyBehaviour } from './behaviour';
import type { CombatExecutor } from './combat';
import type { SetEntityStateFn } from './core';
import type { EquipmentSlot, EquipmentWeapon } from './equipment';
import type { SimulationContext } from './simulation';

export interface AvatarData {
  id: string;
  level: number;
  life: number;
  name: string;
  xp: number;

  // TODO: implement this as a map? type? where we use a record to enforce equipment type e.g. 1h/2h weapons = weapons, etc
  paperdoll: {
    [EquipmentSlot.MainHand]: EquipmentWeapon | null;

    // [EquipmentSlot.OffHand]: EquipmentWeapon;
  };
}

export interface EnemyData {
  level: number;
  life: number;
  name: string;
  primaryAttack: AttackData;
  xp: number;
}

export type HandleTickFn = (combatExecutor: CombatExecutor) => void;

interface IEntity<State extends object, EntitySnapshot extends object> {
  // meta
  readonly id: string;
  readonly level: number;
  readonly type: EntityType;

  // getters
  get isAlive(): boolean;
  get life(): number;
  get status(): EntityStatus;

  // core
  // oxlint-disable-next-line typescript/method-signature-style -- subtypes narrow the behaviour param; method syntax keeps the bivariant check that permits it
  addBehaviour(behaviour: Behaviour): void;
  getSnapshot: () => EntitySnapshot;
  handleTick: (combatExecutor: CombatExecutor, ctx: SimulationContext) => void;
  removeBehaviour: (id: BehaviourID) => void;
  setState: (setStateFn: SetEntityStateFn<State>) => void;

  // utils
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
  // meta
  readonly type: EntityType.Avatar;
  readonly xp: number;

  // getters
  get mainHandEquipment(): EquipmentWeapon | null;

  // core
  // oxlint-disable-next-line typescript/method-signature-style -- narrows the behaviour param; method syntax keeps the bivariant check that permits it
  addBehaviour(behaviour: AvatarBehaviour): void;

  // utils
  calcAttackDamage: () => number;
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
  // meta
  readonly name: string;
  readonly type: EntityType.Enemy;
  readonly xp: number;

  // getters
  get primaryAttack(): AttackData;

  // core
  // oxlint-disable-next-line typescript/method-signature-style -- narrows the behaviour param; method syntax keeps the bivariant check that permits it
  addBehaviour(behaviour: EnemyBehaviour): void;

  // utils
  calcAttackDamage: () => number;
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
  readonly speed: number;
}

export interface WaveSnapshot {
  readonly enemies: ReadonlyArray<EnemySnapshot>;
  readonly id: string;
}

export interface Wave {
  // meta
  readonly enemies: Array<Enemy>;
  readonly id: string;

  // getters
  get nextLivingEnemy(): Enemy | null;
  get remaining(): number;

  // utils
  getSnapshot: () => WaveSnapshot;
}
