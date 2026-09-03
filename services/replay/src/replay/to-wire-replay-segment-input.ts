import type { ReplaySegmentInput } from '@vers/contract-replay';
import type { ActivityInput, AvatarData } from '@vers/idle-core';
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

export function toWireReplaySegmentInput(
  activity: ActivityInput,
  avatar: AvatarData,
  duration: number,
  simVersion: string,
  stopAtState?: string,
  expectedCheckpointCount?: number,
): ReplaySegmentInput {
  return {
    activity: {
      difficulty: activity.difficulty,
      encounter: {
        waves: activity.encounter.waves.map((wave) =>
          wave.map((enemy) => ({ ...enemy, primaryAttack: { ...enemy.primaryAttack } })),
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
      paperdoll: { mainHand: avatar.paperdoll[EquipmentSlot.MainHand] },
      xp: avatar.xp,
    },
    duration,
    protocol: 1,
    simVersion,
    ...(expectedCheckpointCount !== undefined && { expectedCheckpointCount }),
    ...(stopAtState !== undefined && { stopAtState }),
  };
}
