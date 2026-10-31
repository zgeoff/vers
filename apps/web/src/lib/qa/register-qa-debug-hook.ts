import { QA_SIM_SPEED_MAX } from '@vers/contract-activity';
import type { ReceivedRunOutcome, WorkerClient, WorkerDebugSnapshot } from '@vers/idle-client';
import { RunOutcomeKind, subscribeToRunOutcomes } from '@vers/idle-client';
import type { QARecordStore, WorkerPart } from './types';

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

interface RegisterQADebugHookOptions {
  readonly client: WorkerClient;
  readonly isQAAvatar: boolean;
  readonly records: QARecordStore;
  readonly tabID: string;
  readonly workerTimeoutMs: number;
  readonly writerGeneration: number;
}

export function registerQADebugHook(options: Readonly<RegisterQADebugHookOptions>): () => void {
  const records = options.records;

  const readTabRecord = (): TabRecord =>
    Object.freeze({
      hasSharedWorker: typeof SharedWorker !== 'undefined',
      online: navigator.onLine,
      receivedOutcomes: Object.freeze(records.readReceivedOutcomes()),
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
  // moment it arrives, saves the tab half before it asks the worker, and keeps the capture in
  // storage until a snapshot call reads it complete
  const captureRefusal = async (trigger: Readonly<ReceivedOutcomeRecord>): Promise<void> => {
    // the store guards every storage call, so this catch only meets a fault outside storage
    try {
      const captureID = crypto.randomUUID();
      const capturedAt = Date.now();

      records.addCapture({ captureID, capturedAt, tab: readTabRecord(), trigger });

      const workerPart = await readWorkerPart();

      records.completeCapture(captureID, workerPart);
    } catch (error) {
      records.recordFailure(error);
    }
  };

  const unsubscribe = subscribeToRunOutcomes((received) => {
    const record = { ...received, receivedAt: Date.now() };

    // the tab's session storage outlives the hook's re-registrations and a reload, so the record
    // lists every outcome that reached the tab, whichever worker sent it
    records.addReceivedOutcome(record);

    if (received.outcome.kind === RunOutcomeKind.Refused) {
      records.trackCapture(captureRefusal(record));
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
      // a capture still asking its worker finishes first, so the call returns it complete
      await records.settleCaptures();

      const refusalCaptures = records.takeCaptures(Date.now());

      const workerPart = await readWorkerPart();

      // the page's own view of the network: a DevTools network toggle covers the page and never
      // its shared worker, so the two can disagree
      const tab = readTabRecord();

      const snapshotRecords: QADebugSnapshotRecords = {
        // read after the tab record, so a failure in that read is in this answer
        captureFailures: records.readFailures(),
        refusalCaptures: Object.freeze(refusalCaptures),
        tab,
      };

      const merged =
        'worker' in workerPart
          ? { ...workerPart.worker, ...snapshotRecords }
          : { ...snapshotRecords, workerError: workerPart.workerError };

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
