import { sentryHandle } from './sentry-handle';

type SentryHandle = (typeof sentryHandle)['current'];

export function setSentryHandleForTesting(handle: SentryHandle): SentryHandle {
  const previous = sentryHandle.current;

  sentryHandle.current = handle;

  return previous;
}
