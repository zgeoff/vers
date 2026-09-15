import type { DrainResult } from '@vers/jobs';

const RETRY_POLL_INTERVAL_MS = 5000;

export interface RunRetryDrainsOpts {
  readonly drain: () => Promise<DrainResult>;
  readonly now: () => number;
  readonly usefulUntil: Date;
  readonly wait: (ms: number) => Promise<void>;
}

export async function runRetryDrains(opts: Readonly<RunRetryDrainsOpts>): Promise<void> {
  while (opts.now() < opts.usefulUntil.getTime()) {
    await opts.wait(RETRY_POLL_INTERVAL_MS);

    if (opts.now() >= opts.usefulUntil.getTime()) {
      return;
    }

    const drained = await opts.drain();

    if (drained.completed > 0) {
      return;
    }
  }
}
