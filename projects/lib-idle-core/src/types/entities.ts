import type { ClassID } from '@vers/data';
import type { AvatarBehaviour, Behaviour, BehaviourID, EnemyBehaviour } from './behaviour';
import type { CombatExecutor } from './combat';
import type { SetEntityStateFn } from './core';
import type { EquipmentSlot, EquipmentWeapon } from './equipment';
import type { SimulationContext } from './simulation';

export interface AvatarData {
  class: ClassID;
  id: string;
  level: number;
  life: number;
  name: string;

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
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export type HandleTickFn = (combatExecutor: CombatExecutor) => void;

interface IEntity<State extends object, EntityAppState extends object> {
  // meta
  readonly id: string;
  readonly level: number;
  readonly type: EntityType;

  // getters
  get isAlive(): boolean;
  get life(): number;
  get status(): EntityStatus;

  // core
  // oxlint-disable-next-line typescript/method-signature-style, typescript/prefer-readonly-parameter-types -- subtypes narrow the behaviour param; method syntax keeps the bivariant check that permits it; baseline(#236)
  addBehaviour(behaviour: Behaviour): void;
  getAppState: () => EntityAppState;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  handleTick: (combatExecutor: CombatExecutor, ctx: SimulationContext) => void;
  removeBehaviour: (id: BehaviourID) => void;
  setState: (setStateFn: SetEntityStateFn<State>) => void;

  // utils
  receiveDamage: (amount: number) => void;
}

export type Entity = Avatar | Enemy;

interface ResetConfig {
  soft?: boolean;
}

export interface AvatarState {
  readonly life: number;
  readonly maxLife: number;
  readonly status: EntityStatus;
}

export type AvatarBehaviourAppState = {
  [K in BehaviourID]?: ReturnType<Extract<AvatarBehaviour, { id: K }>['getState']>;
};

export interface AvatarAppState {
  readonly behaviours: AvatarBehaviourAppState;
  readonly class: ClassID;
  readonly id: string;
  readonly isAlive: boolean;
  readonly level: number;
  readonly life: number;
  readonly mainHandAttack: AttackData | null;
  readonly maxLife: number;
  readonly name: string;
  readonly status: EntityStatus;
}

export interface Avatar extends IEntity<AvatarState, AvatarAppState> {
  // meta
  readonly type: EntityType.Avatar;

  // getters
  get mainHandEquipment(): EquipmentWeapon | null;

  // core
  // oxlint-disable-next-line typescript/method-signature-style, typescript/prefer-readonly-parameter-types -- narrows the behaviour param; method syntax keeps the bivariant check that permits it; baseline(#236)
  addBehaviour(behaviour: AvatarBehaviour): void;

  // utils
  calcAttackDamage: () => number;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  reset: (config?: ResetConfig) => void;
}

export interface EnemyState {
  readonly life: number;
  readonly maxLife: number;
  readonly status: EntityStatus;
}

export type EnemyBehaviourAppState = {
  [K in BehaviourID]?: ReturnType<Extract<EnemyBehaviour, { id: K }>['getState']>;
};

export interface EnemyAppState {
  readonly behaviours: EnemyBehaviourAppState;
  readonly id: string;
  readonly isAlive: boolean;
  readonly level: number;
  readonly life: number;
  readonly maxLife: number;
  readonly name: string;
  readonly primaryAttack: AttackData;
  readonly status: EntityStatus;
}

export interface Enemy extends IEntity<EnemyState, EnemyAppState> {
  // meta
  readonly name: string;
  readonly type: EntityType.Enemy;

  // getters
  get primaryAttack(): AttackData;

  // core
  // oxlint-disable-next-line typescript/method-signature-style, typescript/prefer-readonly-parameter-types -- narrows the behaviour param; method syntax keeps the bivariant check that permits it; baseline(#236)
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
  maxDamage: number;
  minDamage: number;
  speed: number;
}

export interface EnemyGroupAppState {
  readonly enemies: Array<EnemyAppState>;
  readonly id: string;
}

export interface EnemyGroup {
  // meta
  readonly enemies: Array<Enemy>;
  readonly id: string;

  // getters
  get nextLivingEnemy(): Enemy | null;
  get remaining(): number;

  // utils
  getAppState: () => EnemyGroupAppState;
}
