import type { ReplaySegmentInput } from '@vers/contract-replay';
import { toAttacksPerSecond } from '@vers/game-utils';
import type { ActivityInput, AvatarData, EquipmentWeapon } from '@vers/idle-core';
import { ActivityFailureAction, ActivityType, EquipmentSlot } from '@vers/idle-core';

const WIRE_FAILURE_ACTIONS: Record<
  ActivityFailureAction,
  ReplaySegmentInput['activity']['failureAction']
> = {
  [ActivityFailureAction.Abort]: 'abort',
  [ActivityFailureAction.Retry]: 'retry',
};

const WIRE_ACTIVITY_TYPES: Record<ActivityType, ReplaySegmentInput['activity']['type']> = {
  [ActivityType.WorldMapEncounter]: 'world_map_encounter',
};

interface ToWireReplaySegmentInputOptions {
  readonly activity: ActivityInput;
  readonly avatar: AvatarData;
  readonly duration: number;
  readonly simVersion: string;
  readonly stopAtState?: string;
  readonly expectedCheckpointCount?: number;
}

export function toWireReplaySegmentInput(
  options: ToWireReplaySegmentInputOptions,
): ReplaySegmentInput {
  const activity = options.activity;
  const avatar = options.avatar;

  return {
    activity: {
      difficulty: activity.difficulty,
      encounter: {
        waves: activity.encounter.waves.map((wave) =>
          wave.map((enemy) => ({
            ...enemy,
            primaryAttack: {
              maxDamage: enemy.primaryAttack.maxDamage,
              minDamage: enemy.primaryAttack.minDamage,
              speed: toAttacksPerSecond(enemy.primaryAttack.speedPerMille),
            },
          })),
        ),
      },
      failureAction: WIRE_FAILURE_ACTIONS[activity.failureAction],
      id: activity.id,
      name: activity.name,
      seed: activity.seed,
      type: WIRE_ACTIVITY_TYPES[activity.type],
    },
    avatar: {
      id: avatar.id,
      level: avatar.level,
      life: avatar.life,
      name: avatar.name,
      paperdoll: { mainHand: toWireWeapon(avatar.paperdoll[EquipmentSlot.MainHand]) },
      xp: avatar.xp,
    },
    duration: options.duration,
    protocol: 1,
    simVersion: options.simVersion,
    ...(options.expectedCheckpointCount !== undefined && {
      expectedCheckpointCount: options.expectedCheckpointCount,
    }),
    ...(options.stopAtState !== undefined && { stopAtState: options.stopAtState }),
  };
}

function toWireWeapon(
  weapon: EquipmentWeapon | null,
): ReplaySegmentInput['avatar']['paperdoll']['mainHand'] {
  if (weapon === null) {
    return null;
  }

  return {
    id: weapon.id,
    maxDamage: weapon.maxDamage,
    minDamage: weapon.minDamage,
    name: weapon.name,
    speed: toAttacksPerSecond(weapon.speedPerMille),
  };
}
