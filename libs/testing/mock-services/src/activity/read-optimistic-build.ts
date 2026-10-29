import type { OptimisticBuildSource } from '@vers/idle-core';
import { buildLevelFromXP, foldOptimisticBuild } from '@vers/idle-core';
import * as z from 'zod';
import * as db from '../db';

interface ReadOptimisticBuildInput {
  readonly avatarID: string;
  readonly settledXP: number;
}

export function readOptimisticBuild(input: Readonly<ReadOptimisticBuildInput>): {
  level: number;
  xp: number;
} {
  const activities = db.activityCollection.findMany((query) =>
    query.where({ avatarID: input.avatarID }),
  );

  const optimistic = foldOptimisticBuild(input.settledXP, collectUnsettledSources(activities));

  return { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP };
}

const CheckpointXPSchema = z.object({ rewards: z.object({ xp: z.number() }) });

interface UnsettledCandidate {
  readonly appendedHead: number;
  readonly id: string;
  readonly status: string;
  readonly verifiedHead: number;
}

function collectUnsettledSources(
  activities: ReadonlyArray<UnsettledCandidate>,
): Array<OptimisticBuildSource> {
  return activities
    .filter(
      (activity) =>
        (activity.status === 'stopped' || activity.status === 'capped') &&
        activity.verifiedHead < activity.appendedHead,
    )
    .map((activity) => {
      const tail = db.checkpointCollection.findFirst((query) =>
        query.where({ activityID: activity.id, version: activity.appendedHead }),
      );

      const unverified = db.checkpointCollection.findMany((query) =>
        query.where({
          activityID: activity.id,
          version: (version) => version > activity.verifiedHead,
        }),
      );

      const unverifiedDeltaSum = unverified.reduce((sum, checkpoint) => {
        const parsed = CheckpointXPSchema.safeParse(checkpoint.payload);

        return parsed.success ? sum + parsed.data.rewards.xp : sum;
      }, 0);

      // the mock verifier settles nothing, so every unverified checkpoint's xp is still owed
      return { settledXP: 0, tailPayload: tail?.payload ?? null, unverifiedDeltaSum };
    });
}
