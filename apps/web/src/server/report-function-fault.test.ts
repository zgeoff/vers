import { expect, onTestFinished, test } from 'bun:test';
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { withTraceContext } from '@vers/service-utils';
import { waitFor } from '@vers/test-utils';
import { createTraceContext } from '@vers/trace';
import invariant from 'tiny-invariant';
import { reportFunctionFault } from './report-function-fault';

test('it logs the fault at error level', () => {
  const lines: Array<{ fields: Record<string, unknown>; message: string }> = [];

  const error = new Error('Service Unavailable');

  reportFunctionFault(error, {
    error: (message, fields) => {
      lines.push({ fields, message });
    },
  });

  expect(lines).toStrictEqual([{ fields: { error }, message: 'server function failed' }]);
});

test('it reports the fault to the error backend tagged with the active trace id', async () => {
  const recorded: Array<Readonly<ErrorEvent>> = [];

  Sentry.init({
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    defaultIntegrations: false,
    dsn: 'https://testpublickey@o0.ingest.sentry.io/1',
    skipOpenTelemetrySetup: true,
  });

  onTestFinished(async () => {
    await Sentry.close();
  });

  const trace = createTraceContext();

  withTraceContext(trace, () => {
    reportFunctionFault(new Error('Service Unavailable'), { error: () => {} });
  });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  invariant(recorded[0], 'one event was recorded');

  expect(recorded[0].tags).toMatchObject({ traceID: trace.traceID });

  expect(recorded[0].exception?.values?.[0]).toMatchObject({
    type: 'Error',
    value: 'Service Unavailable',
  });
});

test("it keeps a trace's tag off a later fault reported outside any trace", async () => {
  const recorded: Array<Readonly<ErrorEvent>> = [];

  // with Sentry's own OTel setup skipped and no context manager registered, the SDK never forks a
  // scope, so a tag set on one would outlive its call
  Sentry.init({
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    defaultIntegrations: false,
    dsn: 'https://testpublickey@o0.ingest.sentry.io/1',
    skipOpenTelemetrySetup: true,
  });

  onTestFinished(async () => {
    await Sentry.close();
  });

  withTraceContext(createTraceContext(), () => {
    reportFunctionFault(new Error('Bad Gateway'), { error: () => {} });
  });

  reportFunctionFault(new Error('Gateway Timeout'), { error: () => {} });

  await waitFor(() => {
    expect(recorded).toHaveLength(2);
  });

  const later = recorded.find((event) => event.exception?.values?.[0]?.value === 'Gateway Timeout');

  invariant(later, 'the fault outside the trace was recorded');

  expect(later.tags?.['traceID']).toBeUndefined();
});
