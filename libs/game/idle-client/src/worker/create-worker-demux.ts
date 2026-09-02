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
  readonly evictAfterMs?: number;

  readonly now?: () => number;

  readonly upgrade: WorkerRuntime['upgrade'];
}

export interface WorkerDemux {
  readonly stop: () => void;
}

const DEFAULT_EVICT_AFTER_MS = 5 * 60 * 1000;

export function createWorkerDemux(options: Readonly<CreateWorkerDemuxOptions>): WorkerDemux {
  const evictAfterMs = options.evictAfterMs ?? DEFAULT_EVICT_AFTER_MS;
  const now = options.now ?? (() => Date.now());

  const incoming = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);
  const outgoing = new BroadcastChannel(RPC_WORKER_TO_CLIENT_CHANNEL);
  const tabs = new Map<string, Tab>();

  // the virtual port delivers synchronously: `upgrade` registers the router's listener before the
  // incoming handler below relays the same frame, so no buffering or `start()` is needed
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
