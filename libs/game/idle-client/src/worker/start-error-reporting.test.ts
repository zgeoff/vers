import { expect, onTestFinished, test } from 'bun:test';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

test('it leaves reporting unstarted when dsn is undefined', async () => {
  const previousHandle = sentryHandle.current;

  await startErrorReporting(undefined);

  expect(sentryHandle.current).toBe(previousHandle);
});

test('it starts reporting when dsn is defined', async () => {
  const previousHandle = sentryHandle.current;

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: () => null,
    disableDefaultIntegrations: true,
  });

  expect(sentryHandle.current).toBeDefined();
});
