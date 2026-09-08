import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { reportWorkerFault } from '../worker/report-worker-fault';
import { CHECKPOINT_QUEUE_DB_NAME, CHECKPOINT_QUEUE_DB_VERSION } from './constants';
import type { CheckpointQueueSchema } from './types';
import { upgradeCheckpointQueueDB } from './upgrade-checkpoint-queue-db';

type JournalConnection = Promise<IDBPDatabase<CheckpointQueueSchema>>;

let queueDB: JournalConnection | null = null;

export function resolveCheckpointQueueDB(): JournalConnection {
  queueDB ??= createJournalConnection();

  return queueDB;
}

// the memo forgets a connection that failed to open, closed for another context's upgrade, or was
// terminated by the browser, so the next caller opens afresh instead of inheriting a dead handle
function createJournalConnection(): JournalConnection {
  const resetMemo = () => {
    if (queueDB === opened) {
      queueDB = null;
    }
  };

  const opened = openDB<CheckpointQueueSchema>(
    CHECKPOINT_QUEUE_DB_NAME,
    CHECKPOINT_QUEUE_DB_VERSION,
    {
      blocked: (currentVersion, blockedVersion) => {
        reportWorkerFault(
          'journal-open',
          new Error(
            `journal open at version ${blockedVersion} is blocked by a connection at version ${currentVersion}`,
          ),
        );
      },
      blocking: () => {
        resetMemo();
        void stopConnection(opened);
      },
      terminated: resetMemo,

      // Shared with the upgrade-driving test, so the open path and that test exercise the same store
      // layout.
      upgrade: upgradeCheckpointQueueDB,
    },
  );

  void resetMemoOnFailure(opened, resetMemo);

  return opened;
}

async function stopConnection(opened: Readonly<JournalConnection>): Promise<void> {
  const database = await opened;

  database.close();
}

async function resetMemoOnFailure(
  opened: Readonly<JournalConnection>,
  resetMemo: () => void,
): Promise<void> {
  try {
    await opened;
  } catch {
    resetMemo();
  }
}
