import { createId } from '@paralleldrive/cuid2';
import { buildStartHash, createGenesisSeed } from '@vers/contract-activity';
import * as db from '../db';
import { os } from './os';

/**
 * Version stamps every mock-minted activity carries; arbitrary, but stable so tests can assert
 * on rows the mock created.
 */
const MOCK_SIM_VERSION = '0.0.0-mock';
const MOCK_CONTENT_VERSION = '0.0.0-mock';

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

  const active = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: opts.input.avatarID, status: 'active' }),
  );

  if (active !== undefined) {
    throw opts.errors.CONFLICT({ data: { activity: active } });
  }

  const id = `act_${createId()}`;
  const seed = createGenesisSeed();

  const startHash = buildStartHash({
    activityID: id,
    contentVersion: MOCK_CONTENT_VERSION,
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
    contentVersion: MOCK_CONTENT_VERSION,
    createdAt: now,
    id,
    keyVersion: 1,
    lastHash: startHash,
    scopeID: opts.input.scopeID,
    scopeType: opts.input.scopeType,
    seed,
    simVersion: MOCK_SIM_VERSION,
    startChainIndex: 0,
    startHash,
    startedAt: now,
    status: 'active',
    stoppedAt: null,
    updatedAt: now,
    verifiedAt: null,
    verifiedHead: 0,
  });

  return activity;
});
