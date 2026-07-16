import type * as Sentry from '@sentry/bun';

type SentryModule = typeof Sentry;

/**
 * Process-wide holder for the lazily-imported Sentry SDK handle: `current` stays undefined until
 * `startErrorReporting` runs with a defined DSN, so a DSN-less process never loads the SDK.
 * `reportUnexpectedError` and `flushErrorReports` read it directly; `startErrorReporting` is its
 * only production writer, and tests swap it through the package's test-only setter.
 */
export const sentryHandle: { current: SentryModule | undefined } = { current: undefined };
