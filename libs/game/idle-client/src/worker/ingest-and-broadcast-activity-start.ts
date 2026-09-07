import type {
  IngestActivityStartNotice,
  IngestActivityStartOutcome,
} from '../submission/ingest-activity-start';
import { ingestActivityStart } from '../submission/ingest-activity-start';
import { WorkerMessageType } from '../types';
import { rejectActivityStart } from './reject-activity-start';
import type { WorkerContext } from './types';

export async function ingestAndBroadcastActivityStart(
  context: WorkerContext,
  activityID: string,
): Promise<IngestActivityStartOutcome> {
  const result = await ingestActivityStart(context.getClient(), activityID);

  context.getDebugRecorder().recordStartAttempt(activityID, result.outcome, result.refusal ?? null);

  if (result.outcome === 'ingested') {
    context.broadcast({ activityID, type: WorkerMessageType.ActivityStartIngested });
  }

  if (result.refusedSnapshot !== undefined) {
    await rejectActivityStart(context, result.refusedSnapshot);
  }

  if (result.notice !== undefined) {
    emitNotice(context, result.notice);
  }

  return result.outcome;
}

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
