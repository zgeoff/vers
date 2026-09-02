import type * as Sentry from '@sentry/bun';

type SentryModule = typeof Sentry;

export const sentryHandle: { current: SentryModule | undefined } = { current: undefined };
