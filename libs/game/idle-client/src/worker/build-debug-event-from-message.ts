import { WorkerMessageType } from '../types';
import type { DebugEventType } from './create-debug-recorder';
import type { WorkerMessage } from './worker-to-client-message-schema';

interface DebugEventInput {
  readonly detail: string;
  readonly type: DebugEventType;
}

// the per-tick simulation update and the reward-slot notice are omitted: at one event per tick
// they would push every other event out of the ring within seconds
export function buildDebugEventFromMessage(message: WorkerMessage): DebugEventInput | null {
  if (message.type === WorkerMessageType.ActivityEnded) {
    return {
      detail: `${message.outcome.activityID} ${message.outcome.kind} xp=${message.outcome.xp}`,
      type: 'run',
    };
  }

  if (message.type === WorkerMessageType.ActivityStartIngested) {
    return { detail: `${message.activityID} ingested`, type: 'start-ingest' };
  }

  if (message.type === WorkerMessageType.CheckpointStreamInvalid) {
    return { detail: `${message.activityID} stream invalid`, type: 'stream' };
  }

  if (message.type === WorkerMessageType.OfflineCapStatus) {
    const status = message.halted ? 'halted' : 'warning';

    return { detail: `${status} remainingMs=${message.remainingMs}`, type: 'run' };
  }

  if (message.type === WorkerMessageType.ResyncStatus) {
    return { detail: message.status.kind, type: 'resync' };
  }

  if (message.type === WorkerMessageType.WriterDisplaced) {
    return { detail: `displaced ${message.activityID ?? 'none'}`, type: 'writer' };
  }

  if (message.type === WorkerMessageType.WriterReady) {
    return { detail: 'ready', type: 'writer' };
  }

  return null;
}
