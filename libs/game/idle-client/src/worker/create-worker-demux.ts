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
  readonly closeListeners: Set<EventListenerOrEventListenerObject>;
  lastSeenAt: number;
  readonly messageListeners: Set<EventListenerOrEventListenerObject>;
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
 * `createBroadcastPort` — are demultiplexed onto a virtual port per tab. Idle tabs are swept on a
 * timer so a tab that never sends an explicit disconnect — there is no such signal over
 * `BroadcastChannel` — does not leak forever. Removing a tab, by sweep or by its own disconnect,
 * fires the virtual port's close listeners, so the RPC handler aborts that tab's in-flight calls
 * and drops its per-connection state.
 */
export function createWorkerDemux(options: Readonly<CreateWorkerDemuxOptions>): WorkerDemux {
  const evictAfterMs = options.evictAfterMs ?? DEFAULT_EVICT_AFTER_MS;
  const now = options.now ?? (() => Date.now());

  const incoming = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);
  const outgoing = new BroadcastChannel(RPC_WORKER_TO_CLIENT_CHANNEL);
  const tabs = new Map<string, Tab>();

  // The returned virtual port is built the moment an unseen tab id first appears, and delivers
  // synchronously: `upgrade` registers the router's message listener before the incoming-channel
  // handler below relays the same frame to it, so no buffering or `start()` concept is needed for
  // correct delivery ordering.
  const buildVirtualPort = (
    tabID: string,

    // the tab's listener sets are this function's whole purpose to mutate (the RPC handler
    // registers its listeners into them); a Set has no readonly form that still allows add()
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    tab: Tab,
  ): VirtualPort => ({
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'message') {
        tab.messageListeners.add(listener);
      }

      if (type === 'close') {
        tab.closeListeners.add(listener);
      }
    },
    postMessage: (data: unknown) => {
      outgoing.postMessage({ data, tabID } satisfies Envelope);
    },
  });

  const removeTab = (tabID: string) => {
    const tab = tabs.get(tabID);

    if (tab === undefined) {
      return;
    }

    tabs.delete(tabID);

    const closed = new Event('close');

    for (const listener of tab.closeListeners) {
      emitToListener(listener, closed);
    }
  };

  incoming.addEventListener('message', (event: MessageEvent<Envelope>) => {
    const data = event.data.data;
    const tabID = event.data.tabID;
    let tab = tabs.get(tabID);

    if (tab === undefined) {
      tab = { closeListeners: new Set(), lastSeenAt: now(), messageListeners: new Set() };

      tabs.set(tabID, tab);

      options.upgrade(buildVirtualPort(tabID, tab), {
        close: () => {
          removeTab(tabID);
        },
      });
    }

    tab.lastSeenAt = now();

    const relayed = new MessageEvent('message', { data });

    for (const listener of tab.messageListeners) {
      emitToListener(listener, relayed);
    }
  });

  const sweep = setInterval(() => {
    const cutoff = now() - evictAfterMs;

    for (const [tabID, tab] of tabs) {
      if (tab.lastSeenAt < cutoff) {
        removeTab(tabID);
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

function emitToListener(listener: EventListenerOrEventListenerObject, event: Event): void {
  if (typeof listener === 'function') {
    listener(event);

    return;
  }

  listener.handleEvent(event);
}
