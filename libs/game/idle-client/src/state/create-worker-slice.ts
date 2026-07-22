import type { WorkerClient } from '../transport/types';

export interface WorkerSlice {
  client: null | WorkerClient;

  /**
   * The activity id a caller has already navigated to the engagement screen for — a device-durable
   * marker outliving any one component's mount, so a screen remounting into an activity already
   * live (the browser back button, re-drilling the same node) reads it as already engaged rather
   * than re-firing the navigation. A fresh activity id, from a genuinely new attempt, never matches
   * it.
   */
  engagedActivityID: null | string;

  initialized: boolean;

  /**
   * Counts fallback writer promotions, ticking on every writer-ready broadcast. Effects that must
   * run once per writer — the initialize/report-online handshake, a panel's latched start attempt
   * — key on it instead of a once-per-page-load guard, so a promoted writer is greeted like a
   * fresh one. Stays 0 for the SharedWorker transport's whole life.
   */
  writerGeneration: number;

  /**
   * Aborts every in-flight RPC call keyed to the current writer generation — a writer death or
   * succession bumps the generation and replaces this with a fresh controller, so a call awaiting
   * a writer that will never answer aborts instead of hanging forever.
   */
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
