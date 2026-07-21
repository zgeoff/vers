import { ActivityFailureAction, EntityStatus } from '@vers/idle-core';
import * as z from 'zod';

const attackDataSchema = z
  .object({
    maxDamage: z.number(),
    minDamage: z.number(),
    speed: z.number(),
  })
  .readonly();

const avatarBehaviourSnapshotSchema = z
  .object({
    // behaviour getters return the engine's open state record, so unknown keys must pass through
    // rather than be stripped
    avatar_weapon_attack: z
      .object({ lastAttackTime: z.number() })
      .catchall(z.unknown())
      .readonly()
      .exactOptional(),
    test: z.object({}).readonly().exactOptional(),
  })
  .readonly();

const avatarSnapshotSchema = z
  .object({
    behaviours: avatarBehaviourSnapshotSchema,
    id: z.string(),
    isAlive: z.boolean(),
    level: z.number(),
    life: z.number(),
    mainHandAttack: attackDataSchema.nullable(),
    maxLife: z.number(),
    name: z.string(),
    status: z.enum(EntityStatus),
  })
  .readonly();

const enemyBehaviourSnapshotSchema = z
  .object({
    // behaviour getters return the engine's open state record, so unknown keys must pass through
    // rather than be stripped
    enemy_primary_attack: z
      .object({ lastAttackTime: z.number() })
      .catchall(z.unknown())
      .readonly()
      .exactOptional(),

    // the enemy test behaviour declares no state shape of its own, so its getter carries the
    // engine's open behaviour-state record rather than an empty object
    test: z.record(z.string(), z.unknown()).readonly().exactOptional(),
  })
  .readonly();

const enemySnapshotSchema = z
  .object({
    behaviours: enemyBehaviourSnapshotSchema,
    id: z.string(),
    isAlive: z.boolean(),
    level: z.number(),
    life: z.number(),
    maxLife: z.number(),
    name: z.string(),
    primaryAttack: attackDataSchema,
    status: z.enum(EntityStatus),
  })
  .readonly();

const waveSnapshotSchema = z
  .object({
    enemies: z.array(enemySnapshotSchema).readonly(),
    id: z.string(),
  })
  .readonly();

const activityLevelUpSchema = z
  .object({
    from: z.number(),
    to: z.number(),
  })
  .readonly();

const activityRewardsSchema = z
  .object({
    xp: z.number(),
  })
  .readonly();

const activitySnapshotSchema = z
  .object({
    currentWave: waveSnapshotSchema.nullable(),
    elapsed: z.number(),
    enemiesRemaining: z.int(),
    id: z.string(),
    levelUp: activityLevelUpSchema.nullable(),
    name: z.string(),
    rewards: activityRewardsSchema,
    waves: z.array(waveSnapshotSchema).readonly(),
    wavesRemaining: z.int(),
  })
  .readonly();

const combatExecutorSnapshotSchema = z
  .object({
    elapsed: z.number(),
  })
  .readonly();

/**
 * A live simulation's rendered state, as broadcast to every connected tab. `activity`, `avatar`,
 * and `combat` are absent only before a run's first install — a worker that has ever started one
 * always carries all three thereafter.
 */
export const simulationSnapshotSchema = z
  .object({
    activity: activitySnapshotSchema.exactOptional(),
    avatar: avatarSnapshotSchema.exactOptional(),
    combat: combatExecutorSnapshotSchema.exactOptional(),
    failureAction: z.enum(ActivityFailureAction),
  })
  .readonly();
