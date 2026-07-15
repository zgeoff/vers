import type { ReplaySegmentInput } from '@vers/contract-replay';
import type { ActivityInput, AvatarData } from '@vers/idle-core';
import { ActivityFailureAction, EquipmentSlot } from '@vers/idle-core';

const WIRE_FAILURE_ACTIONS: Record<
  ActivityFailureAction,
  ReplaySegmentInput['activity']['failureAction']
> = {
  [ActivityFailureAction.Abort]: 'abort',
  [ActivityFailureAction.Retry]: 'retry',
};

/**
 * Converts the engine's native `ActivityInput`/`AvatarData` to the wire shape the cross-version
 * dispatch's `replaySegment` provider endpoint accepts — the two are field-identical, differing
 * only in `failureAction`/`type` being engine enums instead of the wire's string literals.
 */
export function toWireReplaySegmentInput(
  activity: ActivityInput,
  avatar: AvatarData,
  duration: number,
  simVersion: string,
  stopAtState?: string,
): ReplaySegmentInput {
  return {
    activity: {
      difficulty: activity.difficulty,
      enemies: activity.enemies,
      failureAction: WIRE_FAILURE_ACTIONS[activity.failureAction],
      id: activity.id,
      name: activity.name,
      seed: activity.seed,
      type: 'world_map_encounter',
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
    ...(stopAtState !== undefined && { stopAtState }),
  };
}
