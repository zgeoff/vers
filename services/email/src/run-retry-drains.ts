import type { DrainResult, JobState } from '@vers/jobs';

const RETRY_POLL_INTERVAL_MS = 5000;
const RETRY_DRAIN_MAX_DURATION = 8 * 60 * 1000;

export interface RunRetryDrainsOpts {
  readonly drain: () => Promise<DrainResult>;
  readonly readState: () => Promise<JobState | undefined>;
  readonly now: () => number;
  readonly signal: AbortSignal;
  readonly usefulUntil: Date;
  readonly wait: (delayMs: number) => Promise<void>;
}

export async function runRetryDrains(opts: Readonly<RunRetryDrainsOpts>): Promise<void> {
  const effectiveDeadline = Math.min(
    opts.usefulUntil.getTime(),
    opts.now() + RETRY_DRAIN_MAX_DURATION,
  );

  for (;;) {
    await opts.wait(RETRY_POLL_INTERVAL_MS);

    if (opts.signal.aborted || opts.now() >= effectiveDeadline) {
      return;
    }

    const state = await opts.readState();

    if (
      opts.signal.aborted ||
      state === undefined ||
      state === 'completed' ||
      state === 'failed' ||
      state === 'cancelled'
    ) {
      return;
    }

    await opts.drain();
  }
}
