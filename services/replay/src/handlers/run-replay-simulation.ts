import type {
  ActivityCheckpoint,
  ReplaySegmentInput,
  ReplaySegmentOutput,
} from '@vers/contract-replay';
import { toSpeedPerMille } from '@vers/game-utils';
import {
  ActivityCheckpointType,
  ActivityFailureAction,
  ActivityType,
  EquipmentSlot,
} from '@vers/idle-core';
import type {
  ActivityCheckpoint as EngineActivityCheckpoint,
  ActivityInput as EngineActivityInput,
  AvatarData as EngineAvatarData,
} from '@vers/idle-core';
import { runSimulation } from '@vers/idle-core/replay';
import { match } from 'ts-pattern';

export async function runReplaySimulation(input: ReplaySegmentInput): Promise<ReplaySegmentOutput> {
  const result = await runSimulation(
    toEngineActivityInput(input.activity),
    toEngineAvatarData(input.avatar),
    {
      duration: input.duration,
      ...(input.expectedCheckpointCount !== undefined && {
        expectedCheckpointCount: input.expectedCheckpointCount,
      }),
      ...(input.stopAtState !== undefined && { stopAtState: input.stopAtState }),
    },
  );

  return {
    checkpoints: result.checkpoints.map(toWireActivityCheckpoint),
    elapsed: result.elapsed,
    ...(result.haltedOnDurationCap !== undefined && {
      haltedOnDurationCap: result.haltedOnDurationCap,
    }),
  };
}

const ENGINE_FAILURE_ACTIONS: Record<
  ReplaySegmentInput['activity']['failureAction'],
  ActivityFailureAction
> = {
  abort: ActivityFailureAction.Abort,
  retry: ActivityFailureAction.Retry,
};

function toEngineActivityInput(activity: ReplaySegmentInput['activity']): EngineActivityInput {
  return {
    ...activity,
    encounter: {
      waves: activity.encounter.waves.map((wave) =>
        wave.map((enemy) => ({
          ...enemy,
          primaryAttack: {
            maxDamage: enemy.primaryAttack.maxDamage,
            minDamage: enemy.primaryAttack.minDamage,
            speedPerMille: toSpeedPerMille(enemy.primaryAttack.speed),
          },
        })),
      ),
    },
    failureAction: ENGINE_FAILURE_ACTIONS[activity.failureAction],
    type: ActivityType.WorldMapEncounter,
  };
}

function toEngineAvatarData(avatar: ReplaySegmentInput['avatar']): EngineAvatarData {
  const weapon = avatar.paperdoll.mainHand;

  return {
    ...avatar,
    paperdoll: {
      [EquipmentSlot.MainHand]:
        weapon === null
          ? null
          : {
              id: weapon.id,
              maxDamage: weapon.maxDamage,
              minDamage: weapon.minDamage,
              name: weapon.name,
              speedPerMille: toSpeedPerMille(weapon.speed),
            },
    },
  };
}

function toWireActivityCheckpoint(checkpoint: EngineActivityCheckpoint): ActivityCheckpoint {
  const shared = {
    nextSeed: checkpoint.nextSeed,
    rewards: checkpoint.rewards,
    rewardSlots: checkpoint.rewardSlots.map((slot) => ({ ...slot, context: { ...slot.context } })),
    time: checkpoint.time,
    ...(checkpoint.levelUp !== undefined && { levelUp: checkpoint.levelUp }),
  };

  return match(checkpoint)
    .returnType<ActivityCheckpoint>()
    .with({ type: ActivityCheckpointType.Started }, (started) => ({
      ...shared,
      seed: started.seed,
      type: 'started',
    }))
    .with({ type: ActivityCheckpointType.Failed }, () => ({ ...shared, type: 'failed' }))
    .with({ type: ActivityCheckpointType.Completed }, () => ({ ...shared, type: 'completed' }))
    .with({ type: ActivityCheckpointType.Progress }, () => ({ ...shared, type: 'progress' }))
    .exhaustive();
}
