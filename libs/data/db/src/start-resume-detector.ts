export interface StartResumeDetectorConfig {
  readonly intervalMs?: number;
  readonly now?: () => number;
  readonly onResume: (elapsedMs: number) => void;
  readonly thresholdMs?: number;
}

export interface ResumeDetector {
  readonly stop: () => void;
}

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_THRESHOLD_MS = 60_000;

export function startResumeDetector(config: StartResumeDetectorConfig): ResumeDetector {
  const intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
  const thresholdMs = config.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const now = config.now ?? Date.now;
  let lastTickAt = now();

  // timers run on the monotonic clock, which stops with the VM while Fly holds the machine
  // suspended, so a wall-clock jump between two ticks is the only trace the pause leaves
  const timer = setInterval(() => {
    const tickAt = now();
    const elapsedMs = tickAt - lastTickAt;

    lastTickAt = tickAt;

    if (elapsedMs > thresholdMs) {
      config.onResume(elapsedMs);
    }
  }, intervalMs);

  timer.unref();

  return {
    stop: () => {
      clearInterval(timer);
    },
  };
}
