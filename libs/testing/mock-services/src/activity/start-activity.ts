import { createId } from '@paralleldrive/cuid2';
import { buildStartHash, createGenesisSeed } from '@vers/contract-activity';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
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
 * progression, mirroring the real service: CONFLICT carries the already-active activity, and a
 * quarantined chain for the same avatar and scope admits no new starts.
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

  // Mirrors the real handler's duplicate-start idempotency; mock rows carry no writer session,
  // so that leg of the real check has nothing to compare against here.
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

  const id = `act_${createId()}`;
  const seed = createGenesisSeed();

  const startHash = buildStartHash({
    activityID: id,
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
