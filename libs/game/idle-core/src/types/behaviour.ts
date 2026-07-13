import type {
  Avatar,
  CombatExecutor,
  Enemy,
  Entity,
  SetEntityStateFn,
  SimulationContext,
} from '../types';

export type BehaviourState<T> = Readonly<Record<string, unknown>> & T;

export interface IBehaviour<
  T extends Entity,
  S extends BehaviourState<object> = BehaviourState<object>,
> {
  // meta
  readonly id: BehaviourID;

  // getters
  get state(): S;

  // handlers
  handlers: {
    [LifecycleEvent.Death]?: LifecycleHandler<T>;
    [LifecycleEvent.Initialize]?: LifecycleHandler<T>;
    [LifecycleEvent.OnTick]?: CombatLifecycleHandler<T>;
    [LifecycleEvent.Reset]?: LifecycleHandler<T>;
  };

  // core
  getState: () => S;
  predicate: (entity: T) => boolean;
  setState: (setStateFn: SetEntityStateFn<S>) => void;
}

export type LifecycleHandler<T extends Entity> = (entity: T, ctx: SimulationContext) => void;

export type CombatLifecycleHandler<T extends Entity> = (
  entity: T,
  combatExecutor: CombatExecutor,
  ctx: SimulationContext,
) => void;

export enum LifecycleEvent {
  Death = 'death',
  Initialize = 'initialize',
  OnTick = 'on_tick',
  Reset = 'reset',
}

export enum BehaviourID {
  AvatarWeaponAttack = 'avatar_weapon_attack',
  EnemyPrimaryAttack = 'enemy_primary_attack',
  Test = 'test',
}

export type AvatarWeaponAttackBehaviourState = BehaviourState<{
  readonly lastAttackTime: number;
}>;

export interface AvatarWeaponAttackBehaviour extends IBehaviour<
  Avatar,
  AvatarWeaponAttackBehaviourState
> {
  // meta
  readonly id: BehaviourID.AvatarWeaponAttack;

  // getters
  get lastAttackTime(): number;
  get nextAttackTime(): number;
}

export type EnemyPrimaryAttackBehaviourState = BehaviourState<{
  readonly lastAttackTime: number;
}>;

export interface EnemyPrimaryAttackBehaviour extends IBehaviour<
  Enemy,
  EnemyPrimaryAttackBehaviourState
> {
  // meta
  readonly id: BehaviourID.EnemyPrimaryAttack;

  // getters
  get lastAttackTime(): number;
  get nextAttackTime(): number;
}

export interface AvatarTestBehaviour extends IBehaviour<Avatar, Record<never, never>> {
  readonly id: BehaviourID.Test;
}

export interface EnemyTestBehaviour extends IBehaviour<Enemy> {
  readonly id: BehaviourID.Test;
}

export type AvatarBehaviour = AvatarTestBehaviour | AvatarWeaponAttackBehaviour;

export type EnemyBehaviour = EnemyPrimaryAttackBehaviour | EnemyTestBehaviour;

export type Behaviour =
  | AvatarTestBehaviour
  | AvatarWeaponAttackBehaviour
  | EnemyPrimaryAttackBehaviour
  | EnemyTestBehaviour;
