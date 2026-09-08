import type { SupportedMessagePort } from '@orpc/client/message-port';
import { buildProtocolStamp } from './build-protocol-stamp';
import { RPC_CLIENT_TO_WORKER_CHANNEL, RPC_WORKER_TO_CLIENT_CHANNEL } from './constants';

interface Envelope {
  readonly data: unknown;
  readonly protocol: string;
  readonly tabID: string;
}

interface Refusal {
  readonly refused: { readonly protocol: string };
  readonly tabID: string;
}

interface BroadcastPort {
  readonly addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  readonly postMessage: (data: unknown) => void;
}

interface CreateBroadcastPortOptions {
  readonly onRefused?: (workerProtocol: string) => void;
  readonly protocol?: string;
  readonly tabID?: string;
}

// `BroadcastChannel.postMessage` cannot transfer a `MessagePort`, so no real port exists between
// a tab and the elected writer: every frame carries this tab's id and is filtered back to it
export function createBroadcastPort(
  options: Readonly<CreateBroadcastPortOptions> = {},
): SupportedMessagePort {
  const tabID = options.tabID ?? crypto.randomUUID();
  const protocol = options.protocol ?? buildProtocolStamp();

  const outgoing = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);
  const incoming = new BroadcastChannel(RPC_WORKER_TO_CLIENT_CHANNEL);
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const closeListeners = new Set<EventListenerOrEventListenerObject>();

  incoming.addEventListener('message', (event: MessageEvent<Envelope | Refusal>) => {
    if (event.data.tabID !== tabID) {
      return;
    }

    // a refusal closes the port for the RPC link, so every pending call settles with a closed
    // error instead of waiting on an answer that never comes
    if ('refused' in event.data) {
      options.onRefused?.(event.data.refused.protocol);

      const closed = new Event('close');

      for (const listener of closeListeners) {
        emitToListener(listener, closed);
      }

      closeListeners.clear();

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

      if (type === 'close') {
        closeListeners.add(listener);
      }
    },
    postMessage: (data: unknown) => {
      outgoing.postMessage({ data, protocol, tabID } satisfies Envelope);
    },
  };

  return port;
}

function emitToListener(listener: EventListenerOrEventListenerObject, event: Event): void {
  if (typeof listener === 'function') {
    listener(event);

    return;
  }

  listener.handleEvent(event);
}
