import type { StartStatus, StartStatusMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createStartStatusMessage(
  requestID: string,
  status: Readonly<StartStatus>,
): StartStatusMessage {
  return { requestID, status, type: WorkerMessageType.StartStatus };
}
