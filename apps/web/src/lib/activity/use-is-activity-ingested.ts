import { readActivityStart, useLastIngestedActivityID } from '@vers/idle-client';
import { useEffect, useState } from 'react';

/**
 * The last derived answer paired with the activity it was derived for, so the held answer is never
 * read against a different activity before that activity's own read lands.
 */
interface IngestedActivity {
  readonly activityID: string | undefined;
  readonly isIngested: boolean;
}

/**
 * Whether the server holds the named activity, so a read keyed on it answers rather than reporting
 * the activity missing. An activity starts as a local mint carried by a durable pending-start row,
 * and the row is dropped once the worker lands the start on the server — so the absence of that
 * row is what the answer reads, which survives a reload the way a broadcast alone would not. The
 * ingest report is the trigger to read again, not the answer itself.
 *
 * `undefined` reads false, matching an avatar with no activity in flight. A local store that
 * cannot be read reads true, since it says nothing about what the server holds.
 */
export function useIsActivityIngested(activityID: string | undefined): boolean {
  const [ingested, setIngested] = useState<IngestedActivity>({
    activityID: undefined,
    isIngested: false,
  });

  const lastIngestedActivityID = useLastIngestedActivityID();

  useEffect(() => {
    // guards against a stale activity's read landing after the panel has already moved on
    let ignore = false;

    if (activityID === undefined) {
      setIngested({ activityID: undefined, isIngested: false });
    } else {
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

      void derive(activityID);
    }

    return () => {
      ignore = true;
    };
  }, [activityID, lastIngestedActivityID]);

  return ingested.activityID === activityID && ingested.isIngested;
}
