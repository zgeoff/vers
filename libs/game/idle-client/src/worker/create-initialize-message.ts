import type { InitializeMessage } from '../types';
import { ClientMessageType } from '../types';

export function createInitializeMessage(): InitializeMessage {
  return {
    type: ClientMessageType.Initialize,
  };
}
