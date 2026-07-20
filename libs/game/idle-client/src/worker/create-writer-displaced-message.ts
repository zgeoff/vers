import type { WriterDisplacedMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createWriterDisplacedMessage(activityID: null | string): WriterDisplacedMessage {
  return { activityID, type: WorkerMessageType.WriterDisplaced };
}
