import type { IngestActivityStartOutcome } from '../submission/ingest-activity-start';
import { ingestActivityStart } from '../submission/ingest-activity-start';
import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';

/**
 * Submits one client-minted activity start into the server and tells connected tabs when the
 * server takes it. The announcement rides the ingest itself rather than each caller, so every path
 * that lands a start — a flush self-healing a `NOT_FOUND`, a reload-orphan drain — reports it the
 * same way. Nothing is announced for an outcome that leaves the server without the activity.
 */
export async function ingestAndBroadcastActivityStart(
  context: WorkerContext,
  activityID: string,
): Promise<IngestActivityStartOutcome> {
  const outcome = await ingestActivityStart(context.getClient(), activityID);

  if (outcome === 'ingested') {
    context.broadcast({ activityID, type: WorkerMessageType.ActivityStartIngested });
  }

  return outcome;
}
