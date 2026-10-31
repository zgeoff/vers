import type { WorkerDebugSnapshot } from '@vers/idle-client';

export type WorkerPart =
  | { readonly worker: WorkerDebugSnapshot }
  | { readonly workerError: string };

interface NewRefusalCapture {
  readonly captureID: string;
  readonly capturedAt: number;
  readonly tab: unknown;
  readonly trigger: unknown;
}

export interface StoredRefusalCapture {
  readonly capture: {
    readonly [field: string]: unknown;
    readonly captureID: string;
    readonly capturedAt: number;
    readonly pendingUntil: number;
    readonly status: 'complete' | 'pending';
  };
  readonly key: string;
}

export interface QARecordStorage {
  readonly captures: () => Storage;
  readonly outcomes: () => Storage;
}

export interface QARecordStore {
  readonly addCapture: (capture: Readonly<NewRefusalCapture>) => void;
  readonly addReceivedOutcome: (record: unknown) => void;
  readonly completeCapture: (captureID: string, workerPart: Readonly<WorkerPart>) => void;
  readonly readFailures: () => ReadonlyArray<string>;
  readonly readReceivedOutcomes: () => ReadonlyArray<unknown>;
  readonly recordFailure: (error: unknown) => void;
  readonly settleCaptures: (timeoutMs: number) => Promise<void>;
  readonly takeCaptures: (now: number) => ReadonlyArray<unknown>;
  readonly trackCapture: (capture: Promise<void>) => void;
}
