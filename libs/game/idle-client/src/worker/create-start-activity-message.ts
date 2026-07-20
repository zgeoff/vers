import type { StartActivityMessage } from '../types';
import { ClientMessageType } from '../types';

interface CreateStartActivityMessageInput {
  readonly avatarID: string;
  readonly requestID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

export function createStartActivityMessage(
  input: Readonly<CreateStartActivityMessageInput>,
): StartActivityMessage {
  return {
    avatarID: input.avatarID,
    requestID: input.requestID,
    scopeID: input.scopeID,
    scopeType: input.scopeType,
    type: ClientMessageType.StartActivity,
  };
}
