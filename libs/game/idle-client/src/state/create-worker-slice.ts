export interface WorkerSlice {
  initialized: boolean;
  worker: null | SharedWorker;
}

export function createWorkerSlice(): WorkerSlice {
  return {
    initialized: false,
    worker: null,
  };
}
