import type { WorkerClient } from '../transport/types';
import type { LiveRun } from '../worker/live-run-schema';

export interface WorkerSlice {
  client: null | WorkerClient;

  engagedRun: LiveRun | null;

  initialized: boolean;

  resyncSettledAvatarIDs: ReadonlyArray<string>;

  writerGeneration: number;

  writerAbortController: AbortController;
}

export function createWorkerSlice(): WorkerSlice {
  return {
    client: null,
    engagedRun: null,
    initialized: false,
    resyncSettledAvatarIDs: [],
    writerAbortController: new AbortController(),
    writerGeneration: 0,
  };
}
