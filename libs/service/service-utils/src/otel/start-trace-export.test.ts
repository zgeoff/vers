import { expect, onTestFinished, test } from 'bun:test';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { updateEnv } from '@vers/test-utils/bun';
import { startTraceExport } from './start-trace-export';

interface ReceivedExport {
  readonly bodyBytes: number;
  readonly headers: {
    readonly auth: string | null;
    readonly contentType: string | null;
    readonly dataset: string | null;
    readonly path: string;
  };
}

test('it exports a recorded span to the OTLP traces endpoint with the env-configured headers', async () => {
  const received: Array<ReceivedExport> = [];

  const server = Bun.serve({
    fetch: async (request) => {
      const body = await request.arrayBuffer();

      received.push({
        bodyBytes: body.byteLength,
        headers: {
          auth: request.headers.get('authorization'),
          contentType: request.headers.get('content-type'),
          dataset: request.headers.get('x-axiom-dataset'),
          path: new URL(request.url).pathname,
        },
      });

      return Response.json({});
    },
    port: 0,
  });

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', `http://127.0.0.1:${server.port}`);

  updateEnv(
    'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
    'Authorization=Bearer test-token,X-Axiom-Dataset=vers-traces',
  );

  onTestFinished(async () => {
    trace.disable();

    await server.stop();
  });

  const traceExport = startTraceExport({ serviceName: 'test-service' });

  trace.getTracer('test-service').startSpan('test-span').end();

  await traceExport.stop();

  expect(received).toHaveLength(1);

  expect(received[0]?.headers).toStrictEqual({
    auth: 'Bearer test-token',
    contentType: 'application/x-protobuf',
    dataset: 'vers-traces',
    path: '/v1/traces',
  });

  expect(received[0]?.bodyBytes).toBeGreaterThan(0);
});

test('it marks a span active across an await once registered', async () => {
  onTestFinished(() => {
    trace.disable();
  });

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:1');
  startTraceExport({ serviceName: 'test-service' });

  await trace.getTracer('test-service').startActiveSpan('test-span', async (span) => {
    await Promise.resolve();

    expect(trace.getActiveSpan()).toBe(span);

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  });
});
