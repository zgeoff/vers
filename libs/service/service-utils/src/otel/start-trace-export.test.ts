import { expect, onTestFinished, test } from 'bun:test';
import { SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
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

function setupTest() {
  const stack = new AsyncDisposableStack();

  onTestFinished(() => stack.disposeAsync());

  const received: Array<ReceivedExport> = [];

  const handleRequest = async (request: Request): Promise<Response> => {
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
  };

  const server = Bun.serve({ fetch: handleRequest, port: 0 });

  stack.defer(() => server.stop());

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', `http://127.0.0.1:${server.port}`);

  updateEnv(
    'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
    'Authorization=Bearer test-token,X-Axiom-Dataset=vers-traces',
  );

  const traceExport = startTraceExport({ serviceName: 'test-service' });

  // stopping flushes the ended spans and releases the batch processor's periodic timer, which
  // would otherwise leak past the test
  stack.defer(() => traceExport.stop());

  return { received, traceExport };
}

test('it exports a recorded span to the OTLP traces endpoint with the env-configured headers', async () => {
  const ctx = setupTest();

  trace.getTracer('test-service').startSpan('test-span').end();

  await ctx.traceExport.stop();

  expect(ctx.received).toHaveLength(1);

  expect(ctx.received[0]?.headers).toStrictEqual({
    auth: 'Bearer test-token',
    contentType: 'application/x-protobuf',
    dataset: 'vers-traces',
    path: '/v1/traces',
  });

  expect(ctx.received[0]?.bodyBytes).toBeGreaterThan(0);
});

test('it marks a span active across an await once registered', async () => {
  setupTest();

  const observed = await trace
    .getTracer('test-service')
    .startActiveSpan('test-span', async (span) => {
      await Promise.resolve();

      const active = trace.getActiveSpan();

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return { active, span };
    });

  expect(observed.active).toBe(observed.span);
});

test('it injects a traceparent and the baggage for the active context once registered', () => {
  setupTest();

  const carrier: Record<string, string> = {};

  const spanContext = trace.getTracer('test-service').startActiveSpan('test-span', (span) => {
    const withBaggage = propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ tenant: { value: 'north-shelf' } }),
    );

    propagation.inject(withBaggage, carrier);
    span.end();

    return span.spanContext();
  });

  expect(carrier).toStrictEqual({
    baggage: 'tenant=north-shelf',
    traceparent: `00-${spanContext.traceId}-${spanContext.spanId}-01`,
  });
});
