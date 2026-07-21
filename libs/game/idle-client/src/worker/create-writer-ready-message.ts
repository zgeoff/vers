import type { WriterReadyMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createWriterReadyMessage(): WriterReadyMessage {
  return {
    type: WorkerMessageType.WriterReady,
  };
}
