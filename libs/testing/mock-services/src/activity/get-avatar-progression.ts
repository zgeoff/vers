import * as z from 'zod';
import * as db from '../db';
import { os } from './os';

/**
 * Checkpoint types whose `rewards.xp` is a run's final earned total rather than one checkpoint's
 * own delta — the shape a pending entry's `xpDelta` displays.
 */
const TERMINAL_CHECKPOINT_TYPES = new Set(['completed', 'failed']);

const TerminalCheckpointPayloadSchema = z.object({
  rewards: z.object({ xp: z.number() }),
  type: z.string(),
});

/**
 * Returns the avatar's settled xp/level plus one pending entry per terminal-but-unsettled activity
 * — a non-active, non-rejected activity whose `verifiedHead` hasn't caught up to its `appendedHead`
 * — sourced from that activity's tail checkpoint, and an identity entry for the live activity when
 * one is active. Seed `checkpointCollection` to assert on a pending entry's `xpDelta`. The live
 * entry always reports nothing settled: the stored row mirrors the public activity shape, which
 * carries no settled-xp field, so the net a client overlays is asserted against the client's own
 * projection rather than through this handler.
 */
export const getAvatarProgression = os.getAvatarProgression.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    return null;
  }

  const unsettled = db.activityCollection.findMany((q) =>
    q.where({
      avatarID: opts.input.avatarID,
      status: (value) => value !== 'active' && value !== 'rejected',
    }),
  );

  const pending = unsettled
    .filter((activity) => activity.verifiedHead < activity.appendedHead)
    .flatMap((activity) => {
      const checkpoint = db.checkpointCollection.findFirst((q) =>
        q.where({ activityID: activity.id, version: activity.appendedHead }),
      );

      if (checkpoint === undefined) {
        return [];
      }

      const parsed = TerminalCheckpointPayloadSchema.safeParse(checkpoint.payload);

      if (!parsed.success || !TERMINAL_CHECKPOINT_TYPES.has(parsed.data.type)) {
        return [];
      }

      return [{ activityID: activity.id, xpDelta: parsed.data.rewards.xp }];
    });

  const live = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: opts.input.avatarID, status: 'active' }),
  );

  const active = live === undefined ? null : { activityID: live.id, settledXP: 0 };

  return { active, level: avatar.level, pending, xp: avatar.xp };
});
