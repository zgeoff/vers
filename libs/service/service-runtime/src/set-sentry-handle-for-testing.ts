import { sentryHandle } from './sentry-handle';

type SentryHandle = (typeof sentryHandle)['current'];

/**
 * Test-only writer over the process-wide error-reporting handle: swaps in `handle` (`undefined`
 * uninstalls reporting) and returns the handle it replaced, so a suite that starts real reporting
 * can restore the prior handle at cleanup. Production code never calls this — the reporting
 * bootstrap is the handle's only production writer.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the handle is the whole Sentry SDK module namespace, a live client handle with no readonly form and no named package type the rule's allow list could match
export function setSentryHandleForTesting(handle: SentryHandle): SentryHandle {
  const previous = sentryHandle.current;

  sentryHandle.current = handle;

  return previous;
}
