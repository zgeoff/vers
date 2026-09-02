import { sentryHandle } from './sentry-handle';

type SentryHandle = (typeof sentryHandle)['current'];

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the handle is the whole Sentry SDK module namespace, a live client handle with no readonly form and no named package type the rule's allow list could match
export function setSentryHandleForTesting(handle: SentryHandle): SentryHandle {
  const previous = sentryHandle.current;

  sentryHandle.current = handle;

  return previous;
}
