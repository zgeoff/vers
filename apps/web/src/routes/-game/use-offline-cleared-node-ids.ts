import {
  readOfflineClearedNodeIDs,
  useLastCompletedActivityID,
  useResyncStatus,
} from '@vers/idle-client';
import { useEffect, useState } from 'react';

const EMPTY_NODE_ID_SET: ReadonlySet<string> = new Set();

/**
 * The active avatar's world-map nodes cleared offline but not yet server-verified, re-derived from
 * the durable offline outbox on a fresh offline clear and on a reconnect that settles the outbox —
 * an ingest, verification, or rejection. `undefined` returns the empty set, matching an avatar not
 * yet loaded.
 */
export function useOfflineClearedNodeIDs(avatarID: string | undefined): ReadonlySet<string> {
  const [clearedNodeIDs, setClearedNodeIDs] = useState<ReadonlySet<string>>(EMPTY_NODE_ID_SET);
  const lastCompletedActivityID = useLastCompletedActivityID();
  const resyncStatus = useResyncStatus();

  useEffect(() => {
    // guards against a stale avatar's derive landing after a switch has already moved on
    let ignore = false;

    if (avatarID === undefined) {
      setClearedNodeIDs(EMPTY_NODE_ID_SET);
    } else {
      const derive = async (id: string) => {
        try {
          const derived = await readOfflineClearedNodeIDs(id);

          if (!ignore) {
            setClearedNodeIDs((current) => (isSameNodeIDSet(current, derived) ? current : derived));
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

  return avatarID === undefined ? EMPTY_NODE_ID_SET : clearedNodeIDs;
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
