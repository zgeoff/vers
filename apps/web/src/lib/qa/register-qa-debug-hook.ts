import * as Sentry from '@sentry/react';
import { QA_SIM_SPEED_MAX } from '@vers/contract-activity';
import type { ReceivedRunOutcome, WorkerClient, WorkerDebugSnapshot } from '@vers/idle-client';
import { RunOutcomeKind, subscribeToRunOutcomes } from '@vers/idle-client';
import * as z from 'zod';
import { QA_RECORD_KEYS } from './qa-record-keys';
import { readQARecords } from './read-qa-records';
import { updateQARecords } from './update-qa-records';

interface ReceivedOutcomeRecord extends ReceivedRunOutcome {
  readonly receivedAt: number;
}

interface TabRecord {
  readonly hasSharedWorker: boolean;
  readonly online: boolean;
  readonly receivedOutcomes: ReadonlyArray<unknown>;
  readonly tabID: string;
  readonly userAgent: string;
  readonly writerGeneration: number;
}

type WorkerPart = { readonly worker: WorkerDebugSnapshot } | { readonly workerError: string };

interface QADebugSnapshotRecords {
  readonly captureFailures: ReadonlyArray<string>;
  readonly refusalCaptures: ReadonlyArray<unknown>;
  readonly tab: TabRecord;
}

type QADebugSnapshot = QADebugSnapshotRecords &
  (WorkerDebugSnapshot | { readonly workerError: string });

interface QADebugHook {
  readonly setSpeed: (speed: number) => Promise<number>;
  readonly snapshot: () => Promise<QADebugSnapshot>;
}

declare global {
  var __versQA: QADebugHook | undefined;
}

interface QARecordStorage {
  readonly captures: Storage;
  readonly outcomes: Storage;
}

interface RegisterQADebugHookOptions {
  readonly client: WorkerClient;
  readonly isQAAvatar: boolean;
  readonly storage: Readonly<QARecordStorage>;
  readonly tabID: string;
  readonly workerTimeoutMs: number;
  readonly writerGeneration: number;
}

const MAX_RECEIVED_OUTCOMES = 50;

// a refusal can repeat while the network stays down, so storage keeps the latest 10 captures, and
// a phone's storage quota never fills with them
const MAX_REFUSAL_CAPTURES = 10;
const CaptureIDSchema = z.looseObject({ captureID: z.string() });

export function registerQADebugHook(options: Readonly<RegisterQADebugHookOptions>): () => void {
  const captureFailures: Array<string> = [];

  // a full storage quota loses the record it was writing, so the failure stays in memory for the
  // next snapshot call and goes to the error backend, which queues it while the device is offline
  const writeGuarded = (write: () => void): void => {
    try {
      write();
    } catch (error) {
      captureFailures.push(String(error));
      Sentry.captureException(error);
    }
  };

  const readTabRecord = (): TabRecord =>
    Object.freeze({
      hasSharedWorker: typeof SharedWorker !== 'undefined',
      online: navigator.onLine,
      receivedOutcomes: Object.freeze(
        readQARecords(options.storage.outcomes, QA_RECORD_KEYS.receivedOutcomes),
      ),
      tabID: options.tabID,
      userAgent: navigator.userAgent,
      writerGeneration: options.writerGeneration,
    });

  // a worker that hangs would otherwise hold a capture or a snapshot call open for good
  const readWorkerPart = async (): Promise<WorkerPart> => {
    const timeout = Promise.withResolvers<never>();

    const timer = setTimeout(() => {
      timeout.reject(new Error(`the worker sent no snapshot within ${options.workerTimeoutMs} ms`));
    }, options.workerTimeoutMs);

    try {
      return {
        worker: await Promise.race([options.client.readDebugSnapshot({}), timeout.promise]),
      };
    } catch (error) {
      return { workerError: String(error) };
    } finally {
      clearTimeout(timer);
    }
  };

  // a device in airplane mode has no console to reach, so the hook snapshots a refusal itself the
  // moment it arrives, writes the tab half before it asks the worker, and keeps the capture in
  // storage until the next snapshot call reads it
  const captureRefusal = async (trigger: Readonly<ReceivedOutcomeRecord>): Promise<void> => {
    const captureID = crypto.randomUUID();
    const capture = { captureID, capturedAt: Date.now(), tab: readTabRecord(), trigger };

    writeGuarded(() => {
      updateQARecords({
        key: QA_RECORD_KEYS.refusalCaptures,
        storage: options.storage.captures,
        update: (captures) => [...captures, capture].slice(-MAX_REFUSAL_CAPTURES),
      });
    });

    const workerPart = await readWorkerPart();

    writeGuarded(() => {
      updateQARecords({
        key: QA_RECORD_KEYS.refusalCaptures,
        storage: options.storage.captures,
        update: (captures) =>
          captures.map((stored) => {
            const parsed = CaptureIDSchema.safeParse(stored);

            return parsed.success && parsed.data.captureID === captureID
              ? { ...parsed.data, ...workerPart }
              : stored;
          }),
      });
    });
  };

  const unsubscribe = subscribeToRunOutcomes((received) => {
    const record = { ...received, receivedAt: Date.now() };

    // the tab's session storage outlives the hook's re-registrations and a reload, so the record
    // lists every outcome that reached the tab, whichever worker sent it
    writeGuarded(() => {
      updateQARecords({
        key: QA_RECORD_KEYS.receivedOutcomes,
        storage: options.storage.outcomes,
        update: (outcomes) => [...outcomes, record].slice(-MAX_RECEIVED_OUTCOMES),
      });
    });

    if (received.outcome.kind === RunOutcomeKind.Refused) {
      void captureRefusal(record);
    }
  });

  const hook: QADebugHook = {
    setSpeed: async (speed) => {
      if (!Number.isInteger(speed) || speed < 1 || speed > QA_SIM_SPEED_MAX) {
        throw new RangeError(`speed must be an integer from 1 to ${QA_SIM_SPEED_MAX}`);
      }

      const status = await options.client.setSimulationSpeed({
        isQAAvatar: options.isQAAvatar,
        speed,
      });

      if (status.kind === 'refused') {
        throw new Error('the active avatar is not flagged for QA, so it runs at real time only');
      }

      return status.speed;
    },
    snapshot: async () => {
      const refusalCaptures = readQARecords(
        options.storage.captures,
        QA_RECORD_KEYS.refusalCaptures,
      );

      options.storage.captures.removeItem(QA_RECORD_KEYS.refusalCaptures);

      const workerPart = await readWorkerPart();

      const records: QADebugSnapshotRecords = {
        captureFailures: Object.freeze([...captureFailures]),
        refusalCaptures: Object.freeze(refusalCaptures),

        // the page's own view of the network: a DevTools network toggle covers the page and never
        // its shared worker, so the two can disagree
        tab: readTabRecord(),
      };

      const merged =
        'worker' in workerPart
          ? { ...workerPart.worker, ...records }
          : { ...records, workerError: workerPart.workerError };

      // the worker's answer is already a structured clone from the message port, so freezing the
      // merged object is what makes the whole snapshot read-only
      return Object.freeze(merged);
    },
  };

  globalThis.__versQA = hook;

  return () => {
    unsubscribe();

    if (globalThis.__versQA === hook) {
      Reflect.deleteProperty(globalThis, '__versQA');
    }
  };
}
