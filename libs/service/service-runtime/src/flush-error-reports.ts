import { sentryHandle } from './sentry-handle';

const FLUSH_TIMEOUT_MS = 2000;

export function flushErrorReports(): Promise<boolean> {
  if (sentryHandle.current === undefined) {
    return Promise.resolve(true);
  }

  return sentryHandle.current.flush(FLUSH_TIMEOUT_MS);
}
