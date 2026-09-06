import type { OptimisticBuildSource } from '@vers/idle-core';
import { buildLevelFromXP, foldOptimisticBuild } from '@vers/idle-core';
import * as z from 'zod';
import * as db from '../db';
import { os } from './os';

const CheckpointXPSchema = z.object({ rewards: z.object({ xp: z.number() }) });

export const getLatestActivityProgress = os.getLatestActivityProgress.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const activities = db.activityCollection.findMany((q) =>
    q.where({ avatarID: opts.input.avatarID }),
  );

  const [latest] = activities.toSorted((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  if (latest === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const anchor =
    latest.verifiedHead === 0
      ? undefined
      : db.checkpointCollection.findFirst((q) =>
          q.where({ activityID: latest.id, version: latest.verifiedHead }),
        );

  const optimistic = foldOptimisticBuild(avatar.xp, collectUnsettledSources(activities));

  return {
    activity: latest,
    anchor: anchor ?? null,
    appendedHead: latest.appendedHead,
    failureAction: avatar.failureAction,

    // the mock backend tracks no writer session, so every caller may append
    isWriter: true,

    optimisticBuild: { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP },
    serverTime: new Date(),
    verifiedHead: latest.verifiedHead,
  };
});

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
      const tail = db.checkpointCollection.findFirst((q) =>
        q.where({ activityID: activity.id, version: activity.appendedHead }),
      );

      const unverified = db.checkpointCollection.findMany((q) =>
        q.where({ activityID: activity.id, version: (version) => version > activity.verifiedHead }),
      );

      const unverifiedDeltaSum = unverified.reduce((sum, checkpoint) => {
        const parsed = CheckpointXPSchema.safeParse(checkpoint.payload);

        return parsed.success ? sum + parsed.data.rewards.xp : sum;
      }, 0);

      // the mock verifier settles nothing, so every unverified checkpoint's xp is still owed
      return { settledXP: 0, tailPayload: tail?.payload ?? null, unverifiedDeltaSum };
    });
}
