import { expect, onTestFinished, test } from 'bun:test';
import { flushErrorReports } from './flush-error-reports';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

test('it resolves without starting the SDK when reporting was never started', async () => {
  expect(sentryHandle.current).toBeUndefined();

  await expect(flushErrorReports()).toResolve();
});

test('it resolves once every queued report is delivered', async () => {
  const previousHandle = sentryHandle.current;

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: () => null,
    disableDefaultIntegrations: true,
  });

  await expect(flushErrorReports()).toResolve();
});
