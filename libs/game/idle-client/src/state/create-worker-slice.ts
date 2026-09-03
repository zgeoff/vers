import type { WorkerClient } from '../transport/types';

export interface WorkerSlice {
  client: null | WorkerClient;

  engagedActivityID: null | string;

  initialized: boolean;

  writerGeneration: number;

  writerAbortController: AbortController;
}

export function createWorkerSlice(): WorkerSlice {
  return {
    client: null,
    engagedActivityID: null,
    initialized: false,
    writerAbortController: new AbortController(),
    writerGeneration: 0,
  };
}
