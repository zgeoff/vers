import type { DrainResult } from '@vers/jobs';

export interface RunRetryDrainsOpts {
  readonly drain: () => Promise<DrainResult>;
  readonly now: () => number;
  readonly usefulUntil: Date;
  readonly wait: (ms: number) => Promise<void>;
}

export async function runRetryDrains(opts: Readonly<RunRetryDrainsOpts>): Promise<void> {
  for (const delayMs of buildRetryDelaysMs()) {
    await opts.wait(delayMs);

    if (opts.now() >= opts.usefulUntil.getTime()) {
      return;
    }

    const drained = await opts.drain();

    if (drained.failed === 0) {
      return;
    }
  }
}

const DEADLINE_RETRY_DELAY_SECONDS = 15;
const DEADLINE_RETRY_ATTEMPTS = 4;
const RETRY_MARGIN_SECONDS = 1;

function buildRetryDelaysMs(): ReadonlyArray<number> {
  return Array.from({ length: DEADLINE_RETRY_ATTEMPTS }, (_value, attempt) => {
    const backoffSeconds = DEADLINE_RETRY_DELAY_SECONDS * 2 ** attempt;

    return (backoffSeconds + RETRY_MARGIN_SECONDS) * 1000;
  });
}
