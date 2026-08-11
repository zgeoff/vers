import { expect, onTestFinished, test } from 'bun:test';
import { sentryHandle } from './sentry-handle';
import { setSentryHandleForTesting } from './set-sentry-handle-for-testing';
import { startErrorReporting } from './start-error-reporting';

test('it leaves reporting unstarted when dsn is undefined', async () => {
  const previousHandle = sentryHandle.current;

  await startErrorReporting(undefined);

  expect(sentryHandle.current).toBe(previousHandle);
});

test('it starts reporting when dsn is defined', async () => {
  const previousHandle = sentryHandle.current;

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: () => null,
    disableDefaultIntegrations: true,
  });

  expect(sentryHandle.current).toBeDefined();
});
