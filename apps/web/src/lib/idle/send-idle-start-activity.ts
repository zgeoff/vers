import type { ClientMessage, SimulationTransport } from '@vers/idle-client';
import { ClientMessageType } from '@vers/idle-client';

interface SendIdleStartActivityInput {
  readonly avatarID: string;
  readonly requestID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Asks the worker to begin a run for the given scope; it owns the start end to end and answers
 * with a status carrying the same request id for the tab to correlate.
 */
export function sendIdleStartActivity(
  transport: SimulationTransport,
  input: Readonly<SendIdleStartActivityInput>,
): void {
  transport.post({
    avatarID: input.avatarID,
    requestID: input.requestID,
    scopeID: input.scopeID,
    scopeType: input.scopeType,
    type: ClientMessageType.StartActivity,
  } satisfies ClientMessage);
}
