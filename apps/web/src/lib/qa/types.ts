import type { WorkerDebugSnapshot } from '@vers/idle-client';

export type WorkerPart =
  | { readonly worker: WorkerDebugSnapshot }
  | { readonly workerError: string };

interface PendingRefusalCapture {
  readonly captureID: string;
  readonly capturedAt: number;
  readonly pendingUntil: number;
  readonly tab: unknown;
  readonly trigger: unknown;
}

export interface QARecordStorage {
  readonly captures: Storage;
  readonly outcomes: Storage;
}

export interface QARecordStore {
  readonly addCapture: (capture: Readonly<PendingRefusalCapture>) => void;
  readonly addReceivedOutcome: (record: unknown) => void;
  readonly completeCapture: (captureID: string, workerPart: Readonly<WorkerPart>) => void;
  readonly readFailures: () => ReadonlyArray<string>;
  readonly readReceivedOutcomes: () => ReadonlyArray<unknown>;
  readonly recordFailure: (error: unknown) => void;
  readonly takeCaptures: (now: number) => ReadonlyArray<unknown>;
}
