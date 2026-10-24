import { expect, onTestFinished, test } from 'bun:test';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { context, trace as otelTrace, propagation } from '@opentelemetry/api';
import type { ErrorEvent } from '@sentry/bun';
import { withTraceContext } from '@vers/service-utils';
import { waitFor } from '@vers/test-utils';
import { createTraceContext } from '@vers/trace';
import { Elysia } from 'elysia';
import invariant from 'tiny-invariant';
import { reportUnexpectedError } from './report-unexpected-error';
import { sentryHandle } from './sentry-handle';
import { setSentryHandleForTesting } from './set-sentry-handle-for-testing';
import { startErrorReporting } from './start-error-reporting';

test('it does not report when reporting was never started', () => {
  expect(sentryHandle.current).toBeUndefined();

  expect(() => {
    reportUnexpectedError(new Error('never started'));
  }).not.toThrow();
});

test('it reports an error with a traceID tag when called inside a trace context', async () => {
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

  const trace = createTraceContext();

  withTraceContext(trace, () => {
    reportUnexpectedError(new Error('inside a trace scope'));
  });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ traceID: trace.traceID });
});

test('it reports an error with no traceID tag when called outside a trace context', async () => {
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

  reportUnexpectedError(new Error('outside a trace scope'));

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags?.['traceID']).toBeUndefined();
});

test("it keeps a trace's tag off a later report when the OTel plugin registered its context manager first", async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  onTestFinished(() => {
    context.disable();
    propagation.disable();
    otelTrace.disable();
  });

  // the boot order createService uses: the OTel plugin's global context manager first, then
  // Sentry's; the OTel API keeps only the first registration, so an earlier one is cleared here
  context.disable();
  propagation.disable();
  otelTrace.disable();

  new Elysia().use(opentelemetry({ serviceName: 'report-probe' }));

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  withTraceContext(createTraceContext(), () => {
    reportUnexpectedError(new Error('inside a trace scope'));
  });

  reportUnexpectedError(new Error('after the trace scope'));

  await waitFor(() => {
    expect(recorded).toHaveLength(2);
  });

  const later = recorded.find(
    (event) => event.exception?.values?.[0]?.value === 'after the trace scope',
  );

  invariant(later, 'the report outside the trace scope was recorded');

  expect(later.tags?.['traceID']).toBeUndefined();
});
