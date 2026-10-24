import { expect, onTestFinished, test } from 'bun:test';
import { opentelemetry } from '@elysiajs/opentelemetry';
import * as Sentry from '@sentry/bun';
import type { ErrorEvent } from '@sentry/bun';
import { waitFor } from '@vers/test-utils';
import { Elysia } from 'elysia';
import invariant from 'tiny-invariant';
import { reportUnexpectedError } from './report-unexpected-error';
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

test("it keeps one request's tag and user off a concurrent request's report when the OTel plugin starts after it", async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];
  const releaseGate = Promise.withResolvers<void>();

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const app = new Elysia()
    .use(opentelemetry({ serviceName: 'report-probe' }))
    .get('/hold', async () => {
      Sentry.setTag('flow', 'hold');
      Sentry.setUser({ id: 'user-holding' });

      await releaseGate.promise;

      return 'held';
    })
    .get('/fail', () => {
      reportUnexpectedError(new Error('concurrent failure'));

      releaseGate.resolve();

      return 'failed';
    });

  // the SDK's Bun.serve integration forks an isolation scope around each request; app.handle
  // bypasses Bun.serve, so each request forks one the same way
  const held = Sentry.withIsolationScope(() => app.handle(new Request('http://localhost/hold')));

  await Sentry.withIsolationScope(() => app.handle(new Request('http://localhost/fail')));

  await held;

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  invariant(recorded[0], 'the concurrent failure was recorded');

  expect(recorded[0].tags?.['flow']).toBeUndefined();
  expect(recorded[0].user).toBeUndefined();
});

test("it puts an inbound traceparent's trace id on a report when the OTel plugin starts after it", async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const app = new Elysia().use(opentelemetry({ serviceName: 'report-probe' })).get('/fail', () => {
    reportUnexpectedError(new Error('traced failure'));

    return 'failed';
  });

  await app.handle(
    new Request('http://localhost/fail', {
      headers: { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
    }),
  );

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.contexts?.trace?.trace_id).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
});
