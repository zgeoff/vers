interface QueuedRequest {
  readonly callback: () => Promise<void>;
  readonly name: string;
  readonly settle: () => void;
}

interface ExclusiveLockOptions {
  readonly mode: 'exclusive';
}

interface FakeLockManager {
  readonly request: (
    name: string,
    options: ExclusiveLockOptions,
    callback: () => Promise<void>,
  ) => Promise<void>;
}

export interface FakeWebLocks {
  readonly advanceLockQueue: (name: string) => void;

  readonly locks: FakeLockManager;
}

export function createFakeWebLocks(): FakeWebLocks {
  const holders = new Map<string, QueuedRequest>();
  const queues = new Map<string, Array<QueuedRequest>>();

  // the callback runs synchronously on claim — tighter than the real API's task-queued grant, but
  // with identical ordering, which is the property election depends on
  const claimLock = (request: QueuedRequest) => {
    holders.set(request.name, request);

    let outcome: Promise<void>;

    try {
      outcome = request.callback();
    } catch {
      outcome = Promise.resolve();
    }

    void (async () => {
      try {
        await outcome;
      } catch {
        // a rejected callback still releases, matching the real API
      }

      // only the current holder's settlement releases: a forced release may already have
      // promoted a successor this stale chain must not evict
      if (holders.get(request.name) === request) {
        advanceQueue(request.name);
      }

      request.settle();
    })();
  };

  const advanceQueue = (name: string) => {
    holders.delete(name);

    const next = queues.get(name)?.shift();

    if (next !== undefined) {
      claimLock(next);
    }
  };

  return {
    advanceLockQueue: advanceQueue,
    locks: {
      request: (name, _options, onGranted) =>
        new Promise<void>((resolve) => {
          const request: QueuedRequest = { callback: onGranted, name, settle: resolve };

          if (holders.has(name)) {
            const queue = queues.get(name) ?? [];

            queue.push(request);
            queues.set(name, queue);

            return;
          }

          claimLock(request);
        }),
    },
  };
}
