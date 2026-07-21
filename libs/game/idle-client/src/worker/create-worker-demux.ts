import { RPC_CLIENT_TO_WORKER_CHANNEL, RPC_WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import type { WorkerRuntime } from './create-worker-runtime';

interface Envelope {
  readonly data: unknown;
  readonly tabID: string;
}

interface VirtualPort {
  readonly addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  readonly postMessage: (data: unknown) => void;
}

interface Tab {
  readonly listeners: Set<EventListenerOrEventListenerObject>;
  lastSeenAt: number;
}

interface CreateWorkerDemuxOptions {
  /**
   * How long a tab may stay silent before its virtual port is dropped — a re-appearing tab id
   * gets a fresh upgrade. Defaults to five minutes: generous against normal call cadence, short
   * enough that a closed tab's entry does not linger for a whole worker lifetime.
   */
  readonly evictAfterMs?: number;

  /**
   * A clock override — a test injects its own to drive eviction without a real wait.
   */
  readonly now?: () => number;

  readonly upgrade: WorkerRuntime['upgrade'];
}

export interface WorkerDemux {
  readonly stop: () => void;
}

const DEFAULT_EVICT_AFTER_MS = 5 * 60 * 1000;

/**
 * Bridges every tab on the web-locks path to the runtime's router: no real `MessagePort` exists
 * between a tab and the elected writer, so each tab's frames — enveloped with its id by
 * `createBroadcastPort` — are demultiplexed onto a virtual port built the moment an unseen tab id
 * first appears. The virtual port delivers synchronously: `upgrade` registers the router's message
 * listener before this handler relays the same frame to it, so no buffering or `start()` concept
 * is needed for correct delivery ordering. Idle tabs are swept on a timer so a tab that never sends
 * an explicit disconnect — there is no such signal over `BroadcastChannel` — does not leak forever.
 */
export function createWorkerDemux(options: Readonly<CreateWorkerDemuxOptions>): WorkerDemux {
  const evictAfterMs = options.evictAfterMs ?? DEFAULT_EVICT_AFTER_MS;
  const now = options.now ?? (() => Date.now());

  const incoming = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);
  const outgoing = new BroadcastChannel(RPC_WORKER_TO_CLIENT_CHANNEL);
  const tabs = new Map<string, Tab>();

  const buildVirtualPort = (
    tabID: string,

    // the set is this function's whole purpose to mutate (registers the router's listener into
    // it); a Set has no readonly form that still allows add()
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    listeners: Set<EventListenerOrEventListenerObject>,
  ): VirtualPort => ({
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'message') {
        listeners.add(listener);
      }
    },
    postMessage: (data: unknown) => {
      outgoing.postMessage({ data, tabID } satisfies Envelope);
    },
  });

  incoming.addEventListener('message', (event: MessageEvent<Envelope>) => {
    const data = event.data.data;
    const tabID = event.data.tabID;
    let tab = tabs.get(tabID);

    if (tab === undefined) {
      tab = { lastSeenAt: now(), listeners: new Set() };

      tabs.set(tabID, tab);

      options.upgrade(buildVirtualPort(tabID, tab.listeners), {
        close: () => {
          tabs.delete(tabID);
        },
      });
    }

    tab.lastSeenAt = now();

    const relayed = new MessageEvent('message', { data });

    for (const listener of tab.listeners) {
      emitToListener(listener, relayed);
    }
  });

  const sweep = setInterval(() => {
    const cutoff = now() - evictAfterMs;

    for (const [tabID, tab] of tabs) {
      if (tab.lastSeenAt < cutoff) {
        tabs.delete(tabID);
      }
    }
  }, evictAfterMs);

  return {
    stop: () => {
      clearInterval(sweep);

      incoming.close();
      outgoing.close();
    },
  };
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
