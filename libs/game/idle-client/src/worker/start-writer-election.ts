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
