import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { waitFor } from '@vers/test-utils';
import invariant from 'tiny-invariant';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

test('it leaves reporting unstarted when dsn is undefined', async () => {
  const previousHandle = sentryHandle.current;

  await startErrorReporting(undefined);

  expect(sentryHandle.current).toBe(previousHandle);
});

test('it starts reporting when dsn is defined', async () => {
  const previousHandle = sentryHandle.current;

  onTestFinished(async () => {
    await sentryHandle.current?.close();

    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: () => null,
    disableDefaultIntegrations: true,
  });

  expect(sentryHandle.current).toBeDefined();
});

test('it gives an event captured from a non-Error value no synthetic stack', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(async () => {
    await sentryHandle.current?.close();

    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  sentryHandle.current?.captureException('the checkpoint store is unreachable');

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  const exception = recorded[0]?.exception?.values?.[0];

  invariant(exception, 'the non-Error capture was recorded as an exception');

  expect(exception.stacktrace).toBeUndefined();
});
