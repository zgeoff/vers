import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { canEncodeMortonKey, findCellCoord } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { findLiveActivityAvatar } from '../avatar/find-live-activity-avatar';
import { upsertActiveAvatar } from '../avatar/upsert-active-avatar';
import * as db from '../db';
import { os } from './os';

/**
 * Mints a genesis seed per requested node, hashed from the avatar and node id so the same pair
 * always reveals to the same seed across calls — mirroring the real service's idempotent reveal
 * without a persisted chain collection to key off of. Mirrors the real handler's other checks:
 * NODE_UNKNOWN for a scope id that doesn't resolve to a world-map node, and admission gated to the
 * account's active avatar, adopting an absent selection unless a different avatar already holds a
 * live run.
 */
export const revealNodes = os.revealNodes.handler(async (opts) => {
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

  for (const nodeID of opts.input.nodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord === undefined || !canEncodeMortonKey(coord)) {
      throw opts.errors.NODE_UNKNOWN({ data: {} });
    }
  }

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

  return opts.input.nodeIDs.map((nodeID) => {
    const hash = sha256(utf8ToBytes(`vers-mock-genesis|${opts.input.avatarID}|${nodeID}`));

    return { genesisSeed: bytesToHex(hash.slice(0, 16)), nodeID };
  });
});
