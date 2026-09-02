import type * as Sentry from '@sentry/browser';

type SentryModule = typeof Sentry;

export const sentryHandle: { current: SentryModule | undefined } = { current: undefined };
