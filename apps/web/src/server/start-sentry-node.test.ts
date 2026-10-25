import { expect, onTestFinished, test } from 'bun:test';
import type { LogRecord } from '@logtape/logtape';
import { resetSync } from '@logtape/logtape';
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { configureLogging } from '@vers/service-runtime/logging';
import { startTraceExport } from '@vers/service-utils/otel';
import { waitFor } from '@vers/test-utils';
import { updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { makeRequestLogger } from './make-request-logger';
import { withMiddleware } from './middleware';
import { reportFunctionFault } from './report-function-fault';
import { startSentryNode } from './start-sentry-node';
import { withRequestTrace } from './with-request-trace';

function setupTest() {
  const stack = new AsyncDisposableStack();

  onTestFinished(() => stack.disposeAsync());

  const exportPaths: Array<string> = [];

  const handleExport = (request: Request): Response => {
    exportPaths.push(new URL(request.url).pathname);

    return Response.json({});
  };

  const collector = Bun.serve({ fetch: handleExport, port: 0 });

  stack.defer(() => collector.stop());

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', `http://127.0.0.1:${collector.port}`);

  return { exportPaths, stack };
}

test("it keeps one request's tag and user off a concurrent request's error event when the trace exporter starts after it", async () => {
  const ctx = setupTest();
  const recorded: Array<Readonly<ErrorEvent>> = [];
  const releaseGate = Promise.withResolvers<void>();

  startSentryNode('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  ctx.stack.defer(async () => {
    await Sentry.close();
  });

  const traceExport = startTraceExport({ serviceName: 'app-web-test' });

  ctx.stack.defer(() => traceExport.stop());

  const handleRequest = withMiddleware([withRequestTrace], async (request) => {
    if (new URL(request.url).pathname === '/hold') {
      Sentry.setTag('flow', 'hold');
      Sentry.setUser({ id: 'user-holding' });

      await releaseGate.promise;

      return new Response('held');
    }

    reportFunctionFault(new Error('Service Unavailable'), { error: () => {} });

    releaseGate.resolve();

    return new Response('failed');
  });

  // on Node the SDK's http server integration forks an isolation scope around each request; Bun's
  // node:http publishes no request-start channel for it, so each request forks one the same way
  const held = Sentry.withIsolationScope(() =>
    handleRequest(new Request('http://localhost/hold', { headers: { accept: 'text/html' } })),
  );

  await Sentry.withIsolationScope(() =>
    handleRequest(new Request('http://localhost/fail', { headers: { accept: 'text/html' } })),
  );

  await held;

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  invariant(recorded[0], 'the concurrent fault was recorded');

  expect(recorded[0].tags?.['flow']).toBeUndefined();
  expect(recorded[0].user).toBeUndefined();
});

test('it puts the inbound trace id on the log lines, the error event, and the exported span when the trace exporter starts after it', async () => {
  const ctx = setupTest();
  const recorded: Array<Readonly<ErrorEvent>> = [];
  const records: Array<LogRecord> = [];

  startSentryNode('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  ctx.stack.defer(async () => {
    await Sentry.close();
  });

  const traceExport = startTraceExport({ serviceName: 'app-web-test' });

  ctx.stack.defer(() => traceExport.stop());

  const logger = configureLogging({
    category: 'app-web-test',
    format: 'json',
    level: 'info',
    sinks: [
      (record) => {
        records.push(record);
      },
    ],
  });

  ctx.stack.defer(() => {
    resetSync();
  });

  const handleRequest = withMiddleware([withRequestTrace, makeRequestLogger(logger)], () => {
    reportFunctionFault(new Error('Bad Gateway'), logger);

    return new Response('failed');
  });

  const response = await handleRequest(
    new Request('http://localhost/account', {
      headers: {
        accept: 'text/html',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    }),
  );

  await traceExport.stop();

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(response.headers.get('x-trace-id')).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  expect(records).toHaveLength(2);

  expect(records).toSatisfyAll(
    (record: LogRecord) => record.properties['traceID'] === '4bf92f3577b34da6a3ce929d0e0e4736',
  );

  expect(recorded[0]?.tags?.['traceID']).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  expect(recorded[0]?.contexts?.trace?.trace_id).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  expect(ctx.exportPaths).toStrictEqual(['/v1/traces']);
});
