import type { ClientMessage, SimulationTransport } from '@vers/idle-client';
import { ClientMessageType } from '@vers/idle-client';

/**
 * Sends the message a freshly connected worker needs before it reports simulation state. Callers
 * on the fallback transport re-send until the initial state arrives — a post can race the writer
 * election and be lost.
 */
export function sendIdleInitialize(transport: SimulationTransport): void {
  transport.post({ type: ClientMessageType.Initialize } satisfies ClientMessage);
}
