import * as z from 'zod';
import { WorkerMessageType } from '../types';
import type { RunOutcome } from '../worker/run-outcome-schema';
import { workerToClientMessageSchema } from '../worker/worker-to-client-message-schema';
import { WORKER_TO_CLIENT_CHANNEL } from './constants';

export interface ReceivedRunOutcome {
  readonly outcome: RunOutcome;
  readonly workerID: null | string;
}

// the sender's stamp sits outside the message schema, because a field in that schema would change
// the protocol stamp and split the tabs of two builds
const SenderSchema = z.object({ workerID: z.string() });

// a listener of its own on the workers' channel, so a reader sees every outcome any worker on the
// origin sends, including one the tab's store would overwrite before a render
export function subscribeToRunOutcomes(
  onOutcome: (received: Readonly<ReceivedRunOutcome>) => void,
): () => void {
  const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    const parsed = workerToClientMessageSchema.safeParse(event.data);

    if (parsed.success && parsed.data.type === WorkerMessageType.ActivityEnded) {
      const sender = SenderSchema.safeParse(event.data);

      onOutcome({
        outcome: parsed.data.outcome,
        workerID: sender.success ? sender.data.workerID : null,
      });
    }
  });

  return () => {
    channel.close();
  };
}
