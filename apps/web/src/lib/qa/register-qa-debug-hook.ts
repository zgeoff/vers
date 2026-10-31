import { QA_SIM_SPEED_MAX } from '@vers/contract-activity';
import type { ReceivedRunOutcome, WorkerClient, WorkerDebugSnapshot } from '@vers/idle-client';
import { RunOutcomeKind, subscribeToRunOutcomes } from '@vers/idle-client';
import { QA_RECORD_KEYS } from './qa-record-keys';
import { readQARecords } from './read-qa-records';
import { writeQARecord } from './write-qa-record';

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

interface QADebugSnapshot extends WorkerDebugSnapshot {
  readonly refusalCaptures: ReadonlyArray<unknown>;
  readonly tab: TabRecord;
}

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
  readonly tabID: string;
  readonly writerGeneration: number;
}

const MAX_RECEIVED_OUTCOMES = 50;

export function registerQADebugHook(options: Readonly<RegisterQADebugHookOptions>): () => void {
  const readTabRecord = (): TabRecord =>
    Object.freeze({
      hasSharedWorker: typeof SharedWorker !== 'undefined',
      online: navigator.onLine,
      receivedOutcomes: Object.freeze(
        readQARecords(sessionStorage, QA_RECORD_KEYS.receivedOutcomes),
      ),
      tabID: options.tabID,
      userAgent: navigator.userAgent,
      writerGeneration: options.writerGeneration,
    });

  // a device in airplane mode has no console to reach, so the hook snapshots a refusal itself the
  // moment it arrives, and keeps the capture in storage until the next snapshot call reads it
  const captureRefusal = async (trigger: Readonly<ReceivedOutcomeRecord>): Promise<void> => {
    const capturedAt = Date.now();

    // a worker that never answers would lose the whole capture, so the tab half lands first and the
    // worker half follows under the same capture time
    writeRefusalCapture({ capturedAt, part: 'tab', tab: readTabRecord(), trigger });

    try {
      const worker = await options.client.readDebugSnapshot({});

      writeRefusalCapture({ capturedAt, part: 'worker', worker });
    } catch (error) {
      writeRefusalCapture({ capturedAt, part: 'worker', workerError: String(error) });
    }
  };

  const unsubscribe = subscribeToRunOutcomes((received) => {
    const record = { ...received, receivedAt: Date.now() };

    // the tab's session storage outlives the hook's re-registrations and a reload, so the record
    // lists every outcome that reached the tab, whichever worker sent it
    writeQARecord({
      key: QA_RECORD_KEYS.receivedOutcomes,
      maxRecords: MAX_RECEIVED_OUTCOMES,
      record,
      storage: sessionStorage,
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
      // the worker's answer is already a structured clone from the message port, so freezing the
      // merged object is what makes the whole snapshot read-only
      const worker = await options.client.readDebugSnapshot({});

      const refusalCaptures = readQARecords(localStorage, QA_RECORD_KEYS.refusalCaptures);

      localStorage.removeItem(QA_RECORD_KEYS.refusalCaptures);

      return Object.freeze({
        ...worker,
        refusalCaptures: Object.freeze(refusalCaptures),

        // the page's own view of the network: a DevTools network toggle covers the page and never
        // its shared worker, so the two can disagree
        tab: readTabRecord(),
      });
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

// a refusal can repeat while the network stays down, so storage keeps the parts of the latest 10
// captures, and a phone's storage quota never fills with them
const MAX_REFUSAL_CAPTURE_PARTS = 20;

function writeRefusalCapture(capture: unknown): void {
  writeQARecord({
    key: QA_RECORD_KEYS.refusalCaptures,
    maxRecords: MAX_REFUSAL_CAPTURE_PARTS,
    record: capture,
    storage: localStorage,
  });
}
