import type { CheckpointPayload } from '@vers/contract-activity';
import * as z from 'zod';
import * as db from '../db';
import { os } from './os';

export const trackActivityProgress = os.trackActivityProgress.handler(async (opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const activity = db.activityCollection.findFirst((q) => q.where({ id: opts.input.activityID }));

  if (activity === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: activity.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (activity.status !== 'active') {
    throw opts.errors.ACTIVITY_TERMINAL({
      data: { appendedHead: activity.appendedHead, status: activity.status },
    });
  }

  if (opts.input.expectedHead !== activity.appendedHead) {
    throw opts.errors.CONFLICT({ data: { appendedHead: activity.appendedHead } });
  }

  const now = new Date();

  for (const checkpoint of opts.input.checkpoints) {
    await db.checkpointCollection.create({
      activityID: activity.id,
      appendedAt: now,
      hash: checkpoint.hash,
      payload: checkpoint.payload,
      prevHash: checkpoint.prevHash,
      version: checkpoint.version,
    });
  }

  const appendedHead = activity.appendedHead + opts.input.checkpoints.length;
  const lastCheckpoint = opts.input.checkpoints.at(-1);
  const closesStream = lastCheckpoint !== undefined && hasTerminalRewards(lastCheckpoint.payload);

  await db.activityCollection.update(activity, {
    data(record) {
      record.appendedAt = now;
      record.appendedHead = appendedHead;
      record.lastHash = lastCheckpoint === undefined ? record.lastHash : lastCheckpoint.hash;
      record.updatedAt = now;

      if (closesStream) {
        record.status = 'stopped';
        record.stoppedAt = now;
      }
    },
    strict: true,
  });

  return { appendedHead };
});

const TERMINAL_CHECKPOINT_TYPES = new Set(['completed', 'failed']);

const TerminalRewardsSchema = z.object({ xp: z.number() });

function hasTerminalRewards(payload: Readonly<CheckpointPayload>): boolean {
  return (
    TERMINAL_CHECKPOINT_TYPES.has(payload.type) &&
    TerminalRewardsSchema.safeParse(payload['rewards']).success
  );
}
