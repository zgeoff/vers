import { reportUnexpectedError } from '@vers/service-runtime';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import { createReplayCache } from '../replay/create-replay-cache';
import { runReplayIteration } from './run-replay-iteration';
import type { ReplayWorkerDeps, ReplayWorkerHandle } from './types';

/**
 * The idle poll starts here and backs off by one step per consecutive idle-or-errored iteration,
 * up to `MAX_POLL_INTERVAL_MS` — a chain claimed on the very next iteration resets it.
 */
const MIN_POLL_INTERVAL_MS = 1000;
const MAX_POLL_INTERVAL_MS = 5000;

/**
 * Starts the replay worker loop: claim, replay, adjudicate, repeat — one chain in flight at a
 * time, holding the in-process incremental cache for this process's lifetime. An idle iteration,
 * and an errored one alike, sleeps before retrying, backing off as the streak continues — an
 * outage never turns into a hot retry loop; a claimed chain resets the backoff and the loop
 * continues immediately. `stop` lets the in-flight iteration finish and interrupts an idle sleep
 * rather than waiting it out.
 */
export function startReplayWorker(deps: Readonly<ReplayWorkerDeps>): ReplayWorkerHandle {
  const cache = createReplayCache(undefined, (stopError) => {
    deps.logger.error({ err: stopError }, 'replay cache driver stop failed');
  });

  const controller = new AbortController();

  let idleStreak = 0;

  const loop = (async () => {
    while (!controller.signal.aborted) {
      const outcome = await withTraceContext(createTraceContext(), () =>
        runReplayIteration(deps, cache).catch((error: unknown) => {
          deps.logger.error({ err: error }, 'replay worker iteration threw unexpectedly');

          reportUnexpectedError(error);

          return { kind: 'errored' as const };
        }),
      );

      if (controller.signal.aborted) {
        break;
      }

      if (outcome.kind !== 'idle' && outcome.kind !== 'errored') {
        idleStreak = 0;
        continue;
      }

      idleStreak += 1;

      await wait(pickBackoffMs(idleStreak), controller.signal);
    }
  })();

  return {
    stop: async () => {
      controller.abort();

      await loop;
    },
  };
}

function pickBackoffMs(idleStreak: number): number {
  return Math.min(MIN_POLL_INTERVAL_MS * idleStreak, MAX_POLL_INTERVAL_MS);
}

/**
 * Resolves after `ms`, or immediately once `signal` aborts — an idle worker's sleep never
 * outlives a requested stop. The loser of the race leaves no timer or listener behind: both are
 * explicitly cleared once the race settles either way, so a pending timeout never holds up an
 * otherwise-finished shutdown.
 */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  let onAbort: (() => void) | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const abortSignal = new Promise<void>((resolve) => {
    onAbort = resolve;

    signal.addEventListener('abort', onAbort, { once: true });
  });

  const timeout = new Promise<void>((resolve) => {
    timeoutHandle = setTimeout(resolve, ms);
  });

  return Promise.race([timeout, abortSignal]).finally(() => {
    if (onAbort !== undefined) {
      signal.removeEventListener('abort', onAbort);
    }

    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  });
}
