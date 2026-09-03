import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  buildRevealSources,
  canEncodeMortonKey,
  findCellCoord,
  isNodeRevealed,
} from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { findLiveActivityAvatar } from '../avatar/find-live-activity-avatar';
import { upsertActiveAvatar } from '../avatar/upsert-active-avatar';
import * as db from '../db';
import { os } from './os';
import { resolveEncounterNode } from './resolve-encounter-node';

const MOCK_KEY_VERSION = 1;
const MOCK_SECRET_REF = 'worldmap';
const MOCK_SECRET_VERSION = 1;

export const revealNodes = os.revealNodes.handler(async (opts) => {
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

  for (const nodeID of opts.input.nodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord === undefined || !canEncodeMortonKey(coord)) {
      throw opts.errors.NODE_UNKNOWN({ data: {} });
    }
  }

  const selection = db.activeAvatarCollection.findFirst((q) => q.where({ userID: actingUserID }));

  if (selection === undefined) {
    const liveAvatar = findLiveActivityAvatar(actingUserID);

    if (liveAvatar !== null && liveAvatar.id !== opts.input.avatarID) {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: liveAvatar.id, activeAvatarName: liveAvatar.name },
      });
    }

    await upsertActiveAvatar(actingUserID, opts.input.avatarID);
  } else if (selection.avatarID !== opts.input.avatarID) {
    const activeAvatar = db.avatarCollection.findFirst((q) => q.where({ id: selection.avatarID }));

    invariant(activeAvatar !== undefined, 'active avatar selection must name an existing avatar');

    throw opts.errors.AVATAR_NOT_ACTIVE({
      data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
    });
  }

  const sources = buildRevealSources(new Set());

  const nodes = opts.input.nodeIDs
    .filter((nodeID) => isNodeRevealed(sources, nodeID))
    .map((nodeID) => {
      // Hashed from the avatar and node id, so the same pair always derives the same seed.
      const hash = sha256(utf8ToBytes(`vers-mock-genesis|${opts.input.avatarID}|${nodeID}`));
      const encounterNode = resolveEncounterNode('world_map_node', nodeID);

      invariant(encounterNode !== undefined, 'nodeID already validated against a world-map cell');

      const genesisSeed = bytesToHex(hash.slice(0, 16));

      return {
        contentVersion: db.MOCK_CURRENT_CONTENT_VERSION,
        encounterNode,
        genesisSeed,
        anchor: { chainIndex: 0, nextSeed: genesisSeed },
        nodeID,
      };
    });

  return {
    keyVersion: MOCK_KEY_VERSION,
    nodes,
    secretRef: MOCK_SECRET_REF,
    secretVersion: MOCK_SECRET_VERSION,
  };
});
