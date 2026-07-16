import { expect, onTestFinished, test } from 'bun:test';
import { flushErrorReports } from './flush-error-reports';
import { setSentryHandleForTesting } from './set-sentry-handle-for-testing';
import { startErrorReporting } from './start-error-reporting';

test('it resolves true without starting the SDK when reporting was never started', () => {
  const previousHandle = setSentryHandleForTesting(undefined);

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  expect(flushErrorReports()).resolves.toBe(true);
});

test('it resolves true once every queued report is delivered', async () => {
  const previousHandle = setSentryHandleForTesting(undefined);

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: () => null,
    disableDefaultIntegrations: true,
  });

  expect(flushErrorReports()).resolves.toBe(true);
});
