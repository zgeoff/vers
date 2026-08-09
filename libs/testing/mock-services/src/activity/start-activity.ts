import { createId } from '@paralleldrive/cuid2';
import { buildStartHash, createGenesisSeed } from '@vers/contract-activity';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { findLiveActivityAvatar } from '../avatar/find-live-activity-avatar';
import { upsertActiveAvatar } from '../avatar/upsert-active-avatar';
import * as db from '../db';
import { os } from './os';
import { resolveEncounterNode } from './resolve-encounter-node';

/**
 * The sim-version stamp every mock-minted activity carries; arbitrary, but stable so tests can
 * assert on rows the mock created. The content version instead tracks the real current version so
 * MSW-backed client tests can resolve content through the real dispatch.
 */
const MOCK_SIM_VERSION = '0.0.0-mock';

/**
 * Starts an activity for an avatar owned by the acting user, snapshotting the avatar's current
 * progression, mirroring the real service: CONFLICT carries the already-active activity, a
 * quarantined chain for the same avatar and scope admits no new starts, and admission is gated to
 * the account's active avatar — AVATAR_NOT_ACTIVE naming the actual one, with an absent selection
 * adopting the starting avatar unless a different avatar already holds a live run.
 */
export const startActivity = os.startActivity.handler(async (opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserId }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const quarantined = db.activityCollection.findFirst((q) =>
    q.where({
      avatarID: opts.input.avatarID,
      scopeID: opts.input.scopeID,
      scopeType: opts.input.scopeType,
      status: 'quarantined',
    }),
  );

  if (quarantined !== undefined) {
    throw opts.errors.CHAIN_QUARANTINED({ data: {} });
  }

  const encounterNode = resolveEncounterNode(opts.input.scopeType, opts.input.scopeID);

  if (encounterNode === undefined) {
    throw opts.errors.NODE_UNKNOWN({ data: {} });
  }

  const active = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: opts.input.avatarID, status: 'active' }),
  );

  // Mirrors the real duplicate-start idempotency, minus the writer-session leg mock rows lack.
  if (active !== undefined) {
    const isDuplicateStart =
      opts.input.startKey !== undefined &&
      active.startKey === opts.input.startKey &&
      active.scopeType === opts.input.scopeType &&
      active.scopeID === opts.input.scopeID &&
      active.appendedHead === 0;

    if (isDuplicateStart) {
      return active;
    }

    throw opts.errors.CONFLICT({ data: { activity: active } });
  }

  // Runs only once a conflicting start is ruled out: the real handler's admission check and its
  // insert share one transaction, so a conflict rolls back any adopt it made — this mock has no
  // transaction to roll back, so it orders the check after the conflict lookup instead.
  const selection = db.activeAvatarCollection.findFirst((q) => q.where({ userID: actingUserId }));

  if (selection === undefined) {
    const liveAvatar = findLiveActivityAvatar(actingUserId);

    if (liveAvatar !== null && liveAvatar.id !== opts.input.avatarID) {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: liveAvatar.id, activeAvatarName: liveAvatar.name },
      });
    }

    await upsertActiveAvatar(actingUserId, opts.input.avatarID);
  } else if (selection.avatarID !== opts.input.avatarID) {
    const activeAvatar = db.avatarCollection.findFirst((q) => q.where({ id: selection.avatarID }));

    invariant(activeAvatar !== undefined, 'active avatar selection must name an existing avatar');

    throw opts.errors.AVATAR_NOT_ACTIVE({
      data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
    });
  }

  const id = `act_${createId()}`;
  const seed = createGenesisSeed();

  const startHash = buildStartHash({
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode,
    keyVersion: 1,
    seed,
    simVersion: MOCK_SIM_VERSION,
  });

  const now = new Date();

  const activity = await db.activityCollection.create({
    appendedAt: null,
    appendedHead: 0,
    avatarID: opts.input.avatarID,
    buildSnapshot: { level: avatar.level, xp: avatar.xp },
    contentVersion: CURRENT_CONTENT_VERSION,
    createdAt: now,
    encounterNode,
    id,
    keyVersion: 1,
    lastHash: startHash,
    scopeID: opts.input.scopeID,
    scopeType: opts.input.scopeType,
    seed,
    secretRef: 'worldmap',
    secretVersion: 1,
    simVersion: MOCK_SIM_VERSION,
    startChainIndex: 0,
    startHash,
    startKey: opts.input.startKey ?? null,
    startedAt: now,
    status: 'active',
    stoppedAt: null,
    updatedAt: now,
    verifiedAt: null,
    verifiedHead: 0,
  });

  return activity;
});
