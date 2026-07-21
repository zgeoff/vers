import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { waitFor } from '@vers/test-utils';
import { reportWorkerFault } from './report-worker-fault';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

test('it does not report when reporting was never started', () => {
  expect(sentryHandle.current).toBeUndefined();

  expect(() => {
    reportWorkerFault('tick-loop', new Error('never started'));
  }).not.toThrow();
});

test('it reports the error tagged with its capture site', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  reportWorkerFault('resync', new Error('resync exploded'));

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'resync' });
  expect(recorded[0]?.exception?.values?.[0]?.value).toBe('resync exploded');
});

test('it forwards extra tags and keeps the capture site over a colliding tag', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  reportWorkerFault('checkpoint-flush', new Error('flush stalled'), {
    site: 'not-the-capture-site',
    traceID: 'trace_1',
  });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'checkpoint-flush', traceID: 'trace_1' });
});
