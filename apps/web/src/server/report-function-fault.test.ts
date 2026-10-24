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
    error: (fields, message) => {
      lines.push({ fields, message });
    },
  });

  expect(lines).toStrictEqual([{ fields: { err: error }, message: 'server function failed' }]);
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
