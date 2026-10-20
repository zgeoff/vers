import { readActivityStart, useLastIngestedActivityID } from '@vers/idle-client';
import { useEffect, useState } from 'react';

interface IngestedActivity {
  readonly activityID: string | undefined;
  readonly isIngested: boolean;
}

export function useIsActivityIngested(activityID: string | undefined): boolean {
  const [ingested, setIngested] = useState<IngestedActivity>({
    activityID: undefined,
    isIngested: false,
  });

  const lastIngestedActivityID = useLastIngestedActivityID();

  if (activityID === undefined && ingested.activityID !== undefined) {
    setIngested({ activityID: undefined, isIngested: false });
  }

  useEffect(() => {
    // guards against a stale activity's read landing after the panel has already moved on
    let ignore = false;

    const derive = async (id: string) => {
      try {
        const pendingStart = await readActivityStart(id);

        if (!ignore) {
          setIngested({ activityID: id, isIngested: pendingStart === undefined });
        }
      } catch {
        // a device whose local store cannot be read tells us nothing about what the server
        // holds, so the read goes ahead: an activity the server does hold still shows its
        // rewards, at the cost of one refused read for one it does not
        if (!ignore) {
          setIngested({ activityID: id, isIngested: true });
        }
      }
    };

    if (activityID !== undefined) {
      void derive(activityID);
    }

    return () => {
      ignore = true;
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- an ingest changes the local store this effect re-reads
  }, [activityID, lastIngestedActivityID]);

  return ingested.activityID === activityID && ingested.isIngested;
}
