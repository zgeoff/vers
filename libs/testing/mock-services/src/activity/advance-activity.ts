import type { CatchUpContinuation, OfflineRootSubmission } from '@vers/contract-activity';
import invariant from 'tiny-invariant';
import { findLiveActivityAvatar } from '../avatar/find-live-activity-avatar';
import { upsertActiveAvatar } from '../avatar/upsert-active-avatar';
import * as db from '../db';
import { os } from './os';

/**
 * Bulk mint-and-appends a catch-up, mirroring the real service's per-continuation transitions at
 * the same simplification level `trackActivityProgress`'s mock accepts: each entry appends its
 * tail onto the currently active row, closes it by flipping to `stopped`, and mints the entry's own
 * id as the next active row using its own hint `buildSnapshot` — the mock has no settled-xp state
 * to author it from. A non-active target row converges on an already-minted continuation the same
 * way the real endpoint's mint dedup does — same avatar, `startKey`, and scope — rather than
 * rejecting a lost-response retry outright. Hash-chain validation, the offline-progress cap, and
 * writer eviction need state the mock doesn't track — those rejections are per-test overrides.
 *
 * When `activityID` names no row and `root` is present, mints it from `root`'s own fields —
 * trusted wholesale, mirroring `startActivity`'s mock — after the same avatar-ownership and
 * active-avatar checks `startActivity`'s mock runs. The node-selectable, sim-version, and
 * live-anchor gates need state the mock doesn't track — those rejections are per-test overrides too.
 */
export const advanceActivity = os.advanceActivity.handler(async (opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const initialActivity = db.activityCollection.findFirst((q) =>
    q.where({ id: opts.input.activityID }),
  );

  let activity: NonNullable<typeof initialActivity>;

  if (initialActivity === undefined) {
    activity = await mintRootActivity(opts.input.activityID, opts.input.root, opts, actingUserId);
  } else {
    const avatar = db.avatarCollection.findFirst((q) =>
      q.where({ id: initialActivity.avatarID, userID: actingUserId }),
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

/**
 * Payload shape for `mintRootActivity`'s AVATAR_NOT_ACTIVE.
 */
interface MintRootAvatarNotActivePayload {
  readonly data: { readonly activeAvatarID: string; readonly activeAvatarName: string };
}

/**
 * Payload shape for a data-less contract error (`mintRootActivity`'s NOT_FOUND).
 */
interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

/**
 * Errors `mintRootActivity` throws directly — a subset of `advanceActivity`'s full error map.
 */
interface MintRootErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: MintRootAvatarNotActivePayload) => Error;
  readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
}

/**
 * Mints `root` as a fresh active row at `activityID`, mirroring `startActivity`'s mock: ownership
 * of `root.avatarID` and the account's active-avatar selection are checked exactly as a fresh start
 * would, and every other pinned field is trusted from `root` wholesale rather than re-derived —
 * the node-selectable, sim-version, and live-anchor gates the real endpoint runs need state this
 * mock doesn't track.
 */
async function mintRootActivity(
  activityID: string,
  root: OfflineRootSubmission | undefined,
  opts: Readonly<{ errors: MintRootErrors }>,
  actingUserID: string,
): Promise<NonNullable<ReturnType<typeof db.activityCollection.findFirst>>> {
  if (root === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: root.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const selection = db.activeAvatarCollection.findFirst((q) => q.where({ userID: actingUserID }));

  if (selection === undefined) {
    const liveAvatar = findLiveActivityAvatar(actingUserID);

    if (liveAvatar !== null && liveAvatar.id !== root.avatarID) {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: liveAvatar.id, activeAvatarName: liveAvatar.name },
      });
    }

    await upsertActiveAvatar(actingUserID, root.avatarID);
  } else if (selection.avatarID !== root.avatarID) {
    const activeAvatar = db.avatarCollection.findFirst((q) => q.where({ id: selection.avatarID }));

    invariant(activeAvatar !== undefined, 'active avatar selection must name an existing avatar');

    throw opts.errors.AVATAR_NOT_ACTIVE({
      data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
    });
  }

  const minted = await db.activityCollection.create({
    avatarID: root.avatarID,
    buildSnapshot: root.buildSnapshot,
    contentVersion: root.contentVersion,
    encounterNode: root.encounterNode,
    id: activityID,
    keyVersion: root.keyVersion,
    scopeID: root.scopeID,
    scopeType: root.scopeType,
    secretRef: root.secretRef,
    secretVersion: root.secretVersion,
    seed: root.seed,
    simVersion: root.simVersion,
    startChainIndex: root.startChainIndex,
    startHash: root.startHash,
    startKey: root.startKey,
    status: 'active',
  });

  invariant(minted !== undefined, 'a freshly minted mock root row must exist');

  return minted;
}

/**
 * The provenance a mint dedup checks a candidate row against — the same fields the real
 * endpoint's own dedup requires beyond ownership alone.
 */
interface MintProvenance {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Resolves a continuation whose target row is no longer active: an existing row at the
 * continuation's id converges only when it is genuinely the continuation this request is
 * retrying — owned by the same avatar, minted from the same `startKey`, and scoped to the same
 * chain — mirroring the real endpoint's mint-id dedup. Anything short of that full match,
 * including no row at all, is `undefined`.
 */
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
