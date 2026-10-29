import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import * as db from '../db';

interface ChainAnchor {
  readonly chainIndex: number;
  readonly nextSeed: string;
}

interface ReadAppendedAnchorInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

export interface AppendedAnchor {
  readonly anchor: ChainAnchor;
  readonly genesisSeed: string;
}

// the mock keeps no chain row, so the anchor is the furthest tail an activity on the node left
// when it left active play; a `started` tail draws nothing from the seed and moves nothing, as the
// real service's anchor rule holds
export function readAppendedAnchor(input: Readonly<ReadAppendedAnchorInput>): AppendedAnchor {
  // hashed from the avatar and node id, so the same pair always derives the same seed
  const hash = sha256(utf8ToBytes(`vers-mock-genesis|${input.avatarID}|${input.scopeID}`));
  const genesisSeed = bytesToHex(hash.slice(0, 16));

  const exited = db.activityCollection.findMany((query) =>
    query.where({
      avatarID: input.avatarID,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
      status: (status) => status === 'stopped' || status === 'capped',
    }),
  );

  let anchor: ChainAnchor = { chainIndex: 0, nextSeed: genesisSeed };

  for (const activity of exited) {
    const tail = db.checkpointCollection.findFirst((query) =>
      query.where({ activityID: activity.id, version: activity.appendedHead }),
    );

    if (
      tail !== undefined &&
      tail.payload.type !== 'started' &&
      tail.payload.chainIndex > anchor.chainIndex
    ) {
      anchor = { chainIndex: tail.payload.chainIndex, nextSeed: tail.payload.nextSeed };
    }
  }

  return { anchor, genesisSeed };
}
