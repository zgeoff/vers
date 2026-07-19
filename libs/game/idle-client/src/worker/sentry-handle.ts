import type * as Sentry from '@sentry/browser';

type SentryModule = typeof Sentry;

/**
 * Worker-wide holder for the lazily-imported Sentry SDK handle: `current` stays undefined until
 * the error-reporting bootstrap runs with a defined DSN, so a DSN-less worker never loads the SDK.
 * The fault reporter reads it directly; the error-reporting bootstrap is its only production
 * writer, and tests swap it in place.
 */
export const sentryHandle: { current: SentryModule | undefined } = { current: undefined };
