import invariant from 'tiny-invariant';
import { WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import { WorkerMessageType } from '../types';
import type { WorkerRuntime } from './create-worker-runtime';
import { startWriterElection } from './start-writer-election';
import { workerToClientMessageSchema } from './worker-to-client-message-schema';
import type { WorkerMessage } from './worker-to-client-message-schema';

interface ExclusiveLockOptions {
  readonly mode: 'exclusive';
}

interface WriterLocks {
  readonly request: (
    name: string,
    options: ExclusiveLockOptions,
    callback: () => Promise<void>,
  ) => Promise<void>;
}

interface CreateWriterGateOptions {
  readonly createRuntime: () => Pick<WorkerRuntime, 'handleConnect'>;

  readonly locks: WriterLocks;
}

export interface WriterGate {
  readonly handleConnect: (event: MessageEvent) => void;
  readonly stop: () => void;
}

// a SharedWorker is one per script URL, so two builds under one origin would each boot a writer;
// the gate makes the shared worker take the same origin-wide lock the dedicated workers race, and
// holds every connection until the lock is granted
export function createWriterGate(options: Readonly<CreateWriterGateOptions>): WriterGate {
  const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  const pending: Array<MessageEvent> = [];
  let runtime: Pick<WorkerRuntime, 'handleConnect'> | undefined;

  startWriterElection({
    locks: options.locks,
    onElected: () => {
      runtime = options.createRuntime();

      for (const event of pending) {
        runtime.handleConnect(event);
      }

      pending.length = 0;

      // announced after the runtime is ready to serve, so a tab's re-sent handshake finds it
      // already listening
      channel.postMessage({ type: WorkerMessageType.WriterReady } satisfies WorkerMessage);
    },
  });

  // another waiting writer's election clears contention in every tab, so a gate still waiting
  // restates it; a channel never hears its own posts, so this reacts to other writers only
  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    const message = workerToClientMessageSchema.safeParse(event.data);

    if (
      runtime === undefined &&
      pending.length > 0 &&
      message.success &&
      message.data.type === WorkerMessageType.WriterReady
    ) {
      channel.postMessage({ type: WorkerMessageType.WriterPending } satisfies WorkerMessage);
    }
  });

  return {
    handleConnect: (event) => {
      invariant(event.ports[0], 'port is required');

      if (runtime !== undefined) {
        runtime.handleConnect(event);

        return;
      }

      pending.push(event);
      channel.postMessage({ type: WorkerMessageType.WriterPending } satisfies WorkerMessage);
    },
    stop: () => {
      channel.close();
    },
  };
}
