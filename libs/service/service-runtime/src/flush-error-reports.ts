import { sentryHandle } from './sentry-handle';

/**
 * Awaits delivery of every report queued so far. No-op when `startErrorReporting` never ran.
 * Callers that report an error immediately before `process.exit` need this — otherwise the event
 * dies with the process before Sentry's background flush gets to run.
 */
export async function flushErrorReports(): Promise<void> {
  await sentryHandle.current?.flush();
}
