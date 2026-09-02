import type { SupportedMessagePort } from '@orpc/client/message-port';
import { RPC_CLIENT_TO_WORKER_CHANNEL, RPC_WORKER_TO_CLIENT_CHANNEL } from './constants';

interface Envelope {
  readonly data: unknown;
  readonly tabID: string;
}

interface BroadcastPort {
  readonly addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  readonly postMessage: (data: unknown) => void;
}

interface CreateBroadcastPortOptions {
  readonly tabID?: string;
}

// `BroadcastChannel.postMessage` cannot transfer a `MessagePort`, so no real port exists between
// a tab and the elected writer: every frame carries this tab's id and is filtered back to it
export function createBroadcastPort(
  options: Readonly<CreateBroadcastPortOptions> = {},
): SupportedMessagePort {
  const tabID = options.tabID ?? crypto.randomUUID();

  const outgoing = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);
  const incoming = new BroadcastChannel(RPC_WORKER_TO_CLIENT_CHANNEL);
  const listeners = new Set<EventListenerOrEventListenerObject>();

  incoming.addEventListener('message', (event: MessageEvent<Envelope>) => {
    if (event.data.tabID !== tabID) {
      return;
    }

    const relayed = new MessageEvent('message', { data: event.data.data });

    for (const listener of listeners) {
      emitToListener(listener, relayed);
    }
  });

  const port: BroadcastPort = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'message') {
        listeners.add(listener);
      }
    },
    postMessage: (data: unknown) => {
      outgoing.postMessage({ data, tabID } satisfies Envelope);
    },
  };

  return port;
}

function emitToListener(
  listener: EventListenerOrEventListenerObject,
  event: MessageEvent<unknown>,
): void {
  if (typeof listener === 'function') {
    listener(event);

    return;
  }

  listener.handleEvent(event);
}
