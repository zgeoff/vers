import type { ResyncStatus, ResyncStatusMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createResyncStatusMessage(status: Readonly<ResyncStatus>): ResyncStatusMessage {
  return { status, type: WorkerMessageType.ResyncStatus };
}
