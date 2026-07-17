import type * as Sentry from '@sentry/browser';

type SentryModule = typeof Sentry;

/**
 * Worker-wide holder for the lazily-imported Sentry SDK handle: `current` stays undefined until
 * `startErrorReporting` runs with a defined DSN, so a DSN-less worker never loads the SDK.
 * `reportWorkerFault` reads it directly; `startErrorReporting` is its only production writer, and
 * tests swap it in place.
 */
export const sentryHandle: { current: SentryModule | undefined } = { current: undefined };
