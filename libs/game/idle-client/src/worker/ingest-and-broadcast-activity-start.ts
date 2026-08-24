import type {
  IngestActivityStartNotice,
  IngestActivityStartOutcome,
} from '../submission/ingest-activity-start';
import { ingestActivityStart } from '../submission/ingest-activity-start';
import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';

/**
 * Submits one client-minted activity start into the server, tells connected tabs when the server
 * takes it, and reports a refusal the player can act on. The announcement rides the ingest itself
 * rather than each caller, so every path that lands a start — a flush self-healing a `NOT_FOUND`, a
 * reload-orphan drain — reports it the same way. Nothing is announced for an outcome that leaves
 * the server without the activity and says nothing a player can act on.
 */
export async function ingestAndBroadcastActivityStart(
  context: WorkerContext,
  activityID: string,
): Promise<IngestActivityStartOutcome> {
  const result = await ingestActivityStart(context.getClient(), activityID);

  if (result.outcome === 'ingested') {
    context.broadcast({ activityID, type: WorkerMessageType.ActivityStartIngested });
  }

  if (result.notice !== undefined) {
    emitNotice(context, result.notice);
  }

  return result.outcome;
}

/**
 * Broadcasts a refusal as the resync-status the tab already renders for it, so a start refused on
 * ingest reaches the player through the same notice a resync's own discovery does.
 */
function emitNotice(context: WorkerContext, notice: Readonly<IngestActivityStartNotice>): void {
  const status =
    notice.kind === 'avatar-switched'
      ? {
          activeAvatarName: notice.activeAvatarName,
          attempts: 0,
          kind: 'avatar-switched' as const,
          levelUps: 0,
        }
      : { kind: 'sim-version-expired' as const };

  context.broadcast({ status, type: WorkerMessageType.ResyncStatus });
}
