import type { ConnectionStatusMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createConnectionStatusMessage(online: boolean): ConnectionStatusMessage {
  return { online, type: WorkerMessageType.ConnectionStatus };
}
