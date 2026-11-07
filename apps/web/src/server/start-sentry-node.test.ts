import { expect, onTestFinished, test } from 'bun:test';
import type { LogRecord } from '@logtape/logtape';
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { configureLogging } from '@vers/service-runtime/logging';
import { startTraceExport } from '@vers/service-utils/otel';
import { waitFor } from '@vers/test-utils';
import { readOpenTelemetryLinks, updateEnv } from '@vers/test-utils/bun';
import type { OpenTelemetryLink } from '@vers/test-utils/bun';
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

test("it keeps one request's tag and user off a concurrent request's error event", async () => {
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

test('it puts the inbound trace id on the log lines, the error event, and the exported span', async () => {
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

test('it leaves the session cookies off a web error event', async () => {
  const ctx = setupTest();
  const recorded: Array<Readonly<ErrorEvent>> = [];

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

  Sentry.addIntegration(Sentry.requestDataIntegration());

  // Bun's node:http publishes no request-start channel, so this sets the request that the SDK's
  // http integration puts on a request's isolation scope under Node
  Sentry.withIsolationScope((scope) => {
    scope.setSDKProcessingMetadata({
      normalizedRequest: {
        headers: {
          accept: 'text/html',
          cookie: 'en_session=sealed-session; en_verification=sealed-code',
        },
        method: 'GET',
        url: 'http://localhost/account',
      },
    });

    Sentry.captureException(new Error('Bad Gateway'));
  });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  // the SDK writes the keys it leaves empty as undefined, which the event's request type can't hold
  const request: unknown = recorded[0]?.request;

  expect(request).toStrictEqual({
    data: undefined,
    headers: { accept: 'text/html' },
    method: 'GET',
    query_string: undefined,
    url: 'http://localhost/account',
  });
});

// the SDK's Node http integration reads a request body only for the body types this list holds,
// and Bun's node:http publishes no request-start channel to drive that read
test('it reads no request body for a web error event', () => {
  const ctx = setupTest();

  startSentryNode('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: () => null,
    disableDefaultIntegrations: true,
  });

  ctx.stack.defer(async () => {
    await Sentry.close();
  });

  expect(Sentry.getClient()?.getDataCollectionOptions().httpBodies).toStrictEqual([]);
});

test('it gives a captured message no synthetic stack', async () => {
  const ctx = setupTest();
  const recorded: Array<Readonly<ErrorEvent>> = [];

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

  Sentry.captureMessage('the session store is unreachable', 'error');

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  invariant(recorded[0], 'the message was recorded');

  expect(recorded[0].exception).toBeUndefined();
});

// bun install links a package outside a Sentry package's OpenTelemetry range with no warning, and
// Bun's overrides don't reach an optional peer
test('it links each OpenTelemetry package that the SDK declares inside the range it declares', () => {
  expect(readOpenTelemetryLinks('@sentry/node', import.meta.dir)).toSatisfy(
    (links: Array<OpenTelemetryLink>) =>
      links.length > 0 && links.every((link) => Bun.semver.satisfies(link.version, link.range)),
  );
});
