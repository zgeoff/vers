import type { CatchUpContinuation, OfflineActivityStartSubmission } from '@vers/contract-activity';
import invariant from 'tiny-invariant';
import { findLiveActivityAvatar } from '../avatar/find-live-activity-avatar';
import { upsertActiveAvatar } from '../avatar/upsert-active-avatar';
import * as db from '../db';
import { os } from './os';

export const advanceActivity = os.advanceActivity.handler(async (opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const initialActivity = db.activityCollection.findFirst((q) =>
    q.where({ id: opts.input.activityID }),
  );

  let activity: NonNullable<typeof initialActivity>;

  if (initialActivity === undefined) {
    activity = await admitActivityStartRow(
      opts.input.activityID,
      opts.input.activityStart,
      opts,
      actingUserID,
    );
  } else {
    const avatar = db.avatarCollection.findFirst((q) =>
      q.where({ id: initialActivity.avatarID, userID: actingUserID }),
    );

    if (avatar === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    activity = initialActivity;
  }

  let expectedHead = opts.input.expectedHead;

  for (const continuation of opts.input.continuations) {
    if (activity.status !== 'active') {
      const converged = resolveMintIDCollision(activity, continuation);

      if (converged === undefined) {
        throw opts.errors.ACTIVITY_TERMINAL({
          data: {
            activityID: activity.id,
            appendedHead: activity.appendedHead,
            status: activity.status,
          },
        });
      }

      activity = converged;
      expectedHead = converged.appendedHead;
      continue;
    }

    if (expectedHead !== activity.appendedHead) {
      throw opts.errors.CONFLICT({
        data: { activityID: activity.id, appendedHead: activity.appendedHead },
      });
    }

    const now = new Date();

    for (const checkpoint of continuation.checkpoints) {
      await db.checkpointCollection.create({
        activityID: activity.id,
        appendedAt: now,
        hash: checkpoint.hash,
        payload: checkpoint.payload,
        prevHash: checkpoint.prevHash,
        version: checkpoint.version,
      });
    }

    const appendedHead = activity.appendedHead + continuation.checkpoints.length;
    const lastCheckpoint = continuation.checkpoints.at(-1);
    const closingActivity = activity;

    await db.activityCollection.update(closingActivity, {
      data(record) {
        record.appendedAt = now;
        record.appendedHead = appendedHead;
        record.lastHash = lastCheckpoint === undefined ? record.lastHash : lastCheckpoint.hash;
        record.status = 'stopped';
        record.stoppedAt = now;
        record.updatedAt = now;
      },
      strict: true,
    });

    const minted = await db.activityCollection.create({
      avatarID: closingActivity.avatarID,
      buildSnapshot: continuation.buildSnapshot,
      contentVersion: closingActivity.contentVersion,
      encounterNode: closingActivity.encounterNode,
      id: continuation.id,
      keyVersion: closingActivity.keyVersion,
      scopeID: closingActivity.scopeID,
      scopeType: closingActivity.scopeType,
      secretRef: closingActivity.secretRef,
      secretVersion: closingActivity.secretVersion,
      simVersion: closingActivity.simVersion,
      startKey: continuation.startKey,
      status: 'active',
    });

    invariant(minted !== undefined, 'a freshly minted mock activity row must exist');

    activity = minted;
    expectedHead = 0;
  }

  return { activity, appendedHead: activity.appendedHead };
});

interface AdmitActivityStartAvatarNotActivePayload {
  readonly data: { readonly activeAvatarID: string; readonly activeAvatarName: string };
}

interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

interface AdmitActivityStartErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: AdmitActivityStartAvatarNotActivePayload) => Error;
  readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
}

async function admitActivityStartRow(
  activityID: string,
  activityStart: OfflineActivityStartSubmission | undefined,
  opts: Readonly<{ errors: AdmitActivityStartErrors }>,
  actingUserID: string,
): Promise<NonNullable<ReturnType<typeof db.activityCollection.findFirst>>> {
  if (activityStart === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: activityStart.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const selection = db.activeAvatarCollection.findFirst((q) => q.where({ userID: actingUserID }));

  if (selection === undefined) {
    const liveAvatar = findLiveActivityAvatar(actingUserID);

    if (liveAvatar !== null && liveAvatar.id !== activityStart.avatarID) {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: liveAvatar.id, activeAvatarName: liveAvatar.name },
      });
    }

    await upsertActiveAvatar(actingUserID, activityStart.avatarID);
  } else if (selection.avatarID !== activityStart.avatarID) {
    const activeAvatar = db.avatarCollection.findFirst((q) => q.where({ id: selection.avatarID }));

    invariant(activeAvatar !== undefined, 'active avatar selection must name an existing avatar');

    throw opts.errors.AVATAR_NOT_ACTIVE({
      data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
    });
  }

  const admitted = await db.activityCollection.create({
    avatarID: activityStart.avatarID,
    buildSnapshot: activityStart.buildSnapshot,
    contentVersion: activityStart.contentVersion,
    id: activityID,
    lastHash: activityStart.startHash,
    scopeID: activityStart.scopeID,
    scopeType: activityStart.scopeType,
    seed: activityStart.seed,
    simVersion: activityStart.simVersion,
    startChainIndex: activityStart.startChainIndex,
    startHash: activityStart.startHash,
    startKey: activityStart.startKey,
    status: 'active',
  });

  invariant(admitted !== undefined, 'a freshly admitted mock activity start must exist');

  return admitted;
}

interface MintProvenance {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

function resolveMintIDCollision(
  pinned: Readonly<MintProvenance>,
  continuation: Readonly<CatchUpContinuation>,
): ReturnType<typeof db.activityCollection.findFirst> {
  const existing = db.activityCollection.findFirst((q) => q.where({ id: continuation.id }));

  if (
    existing === undefined ||
    existing.avatarID !== pinned.avatarID ||
    existing.startKey !== continuation.startKey ||
    existing.scopeType !== pinned.scopeType ||
    existing.scopeID !== pinned.scopeID
  ) {
    return undefined;
  }

  return existing;
}
