import { WRITER_LOCK_NAME } from '../transport/constants';
import { reportWorkerFault } from './report-worker-fault';

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

interface StartWriterElectionOptions {
  readonly locks: WriterLocks;
  readonly onElected: () => void;
}

/**
 * Races the writer lock and holds it for this worker's whole life: the granted callback never
 * settles, so the browser releases the lock only when the worker's tab dies, at which point the
 * next queued waiter is granted and promotes through this same path. Losers wait indefinitely —
 * no steal, no timeout, no retry.
 */
export function startWriterElection(options: StartWriterElectionOptions): void {
  void (async () => {
    try {
      await options.locks.request(WRITER_LOCK_NAME, { mode: 'exclusive' }, () => {
        options.onElected();

        return new Promise<void>(() => {
          // intentionally unsettled: settling would release the writer lock while this worker
          // lives
        });
      });
    } catch (error) {
      // a rejected request means this worker silently never becomes a writer — report it, since
      // no retry can recover a browser that refuses the lock request outright
      reportWorkerFault('writer-election', error);
    }
  })();
}
