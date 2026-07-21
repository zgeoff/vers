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
  /**
   * Overrides the minted tab id — a test's only way to simulate the same tab id reappearing
   * (e.g. after the writer-side demux evicts an idle entry).
   */
  readonly tabID?: string;
}

/**
 * A structural `MessagePort` bridging this tab to the elected web-locks writer's demux: no real
 * port exists between them, and `BroadcastChannel.postMessage` cannot transfer one, so every frame
 * envelopes with this tab's id on the way out and is filtered to it on the way in — the raw
 * channel carries every tab's RPC traffic at once, and an unfiltered read would misroute another
 * tab's reply here. `tabID` is minted fresh per call, one broadcast port per tab session.
 */
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
