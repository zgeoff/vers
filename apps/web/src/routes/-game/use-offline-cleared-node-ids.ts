import {
  readOfflineClearedNodeIDs,
  useLastCompletedActivityID,
  useResyncStatus,
} from '@vers/idle-client';
import { useEffect, useState } from 'react';

const EMPTY_NODE_ID_SET: ReadonlySet<string> = new Set();

interface DerivedClearedNodeIDs {
  readonly avatarID: string | undefined;
  readonly nodeIDs: ReadonlySet<string>;
}

export function useOfflineClearedNodeIDs(avatarID: string | undefined): ReadonlySet<string> {
  const [derived, setDerived] = useState<DerivedClearedNodeIDs>({
    avatarID: undefined,
    nodeIDs: EMPTY_NODE_ID_SET,
  });

  const lastCompletedActivityID = useLastCompletedActivityID();
  const resyncStatus = useResyncStatus();

  if (avatarID === undefined && derived.avatarID !== undefined) {
    setDerived({ avatarID: undefined, nodeIDs: EMPTY_NODE_ID_SET });
  }

  useEffect(() => {
    if (avatarID === undefined) {
      return;
    }

    // guards against a stale avatar's derive landing after a switch has already moved on
    let ignore = false;

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

    return () => {
      ignore = true;
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- a completed activity or a settled resync changes the local store this effect re-reads
  }, [avatarID, lastCompletedActivityID, resyncStatus]);

  return derived.avatarID === avatarID ? derived.nodeIDs : EMPTY_NODE_ID_SET;
}

function isSameNodeIDSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const id of left) {
    if (!right.has(id)) {
      return false;
    }
  }

  return true;
}
