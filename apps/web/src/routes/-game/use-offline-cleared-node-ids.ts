import {
  readOfflineClearedNodeIDs,
  useLastCompletedActivityID,
  useResyncStatus,
} from '@vers/idle-client';
import { useEffect, useState } from 'react';

const EMPTY_NODE_ID_SET: ReadonlySet<string> = new Set();

/**
 * The last derived cleared-node set paired with the avatar it was derived for, so the held set is
 * never read across an avatar switch before the incoming avatar's own derive lands.
 */
interface DerivedClearedNodeIDs {
  readonly avatarID: string | undefined;
  readonly nodeIDs: ReadonlySet<string>;
}

/**
 * The active avatar's world-map nodes cleared offline but not yet server-verified, re-derived from
 * the durable offline outbox on a fresh offline clear and on a reconnect that settles the outbox —
 * an ingest, verification, or rejection. `undefined` returns the empty set, matching an avatar not
 * yet loaded; an avatar switch reads empty until the incoming avatar's derive lands, so the new
 * avatar never briefly inherits the outgoing avatar's cleared nodes.
 */
export function useOfflineClearedNodeIDs(avatarID: string | undefined): ReadonlySet<string> {
  const [derived, setDerived] = useState<DerivedClearedNodeIDs>({
    avatarID: undefined,
    nodeIDs: EMPTY_NODE_ID_SET,
  });

  const lastCompletedActivityID = useLastCompletedActivityID();
  const resyncStatus = useResyncStatus();

  useEffect(() => {
    // guards against a stale avatar's derive landing after a switch has already moved on
    let ignore = false;

    if (avatarID === undefined) {
      setDerived({ avatarID: undefined, nodeIDs: EMPTY_NODE_ID_SET });
    } else {
      const derive = async (id: string) => {
        try {
          const nodeIDs = await readOfflineClearedNodeIDs(id);

          if (!ignore) {
            setDerived((current) =>
              current.avatarID === id && isSameNodeIDSet(current.nodeIDs, nodeIDs)
                ? current
                : { avatarID: id, nodeIDs },
            );
          }
        } catch {
          // a failed local read leaves the previously derived set in place, retried on the next
          // trigger rather than dropping selection the outbox already proved
        }
      };

      void derive(avatarID);
    }

    return () => {
      ignore = true;
    };
  }, [avatarID, lastCompletedActivityID, resyncStatus]);

  return derived.avatarID === avatarID ? derived.nodeIDs : EMPTY_NODE_ID_SET;
}

function isSameNodeIDSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }

  return true;
}
