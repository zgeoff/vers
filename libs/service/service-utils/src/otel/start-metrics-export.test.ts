import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { startMetricsExport } from './start-metrics-export';

interface ReceivedExport {
  readonly auth: string | null;
  readonly bodyBytes: number;
  readonly contentType: string | null;
  readonly dataset: string | null;
  readonly path: string;
}

test('it exports recorded instruments to the OTLP metrics endpoint with the env-configured headers', async () => {
  const received: Array<ReceivedExport> = [];

  const server = Bun.serve({
    fetch: async (request) => {
      const body = await request.arrayBuffer();

      received.push({
        auth: request.headers.get('authorization'),
        bodyBytes: body.byteLength,
        contentType: request.headers.get('content-type'),
        dataset: request.headers.get('x-axiom-metrics-dataset'),
        path: new URL(request.url).pathname,
      });

      return Response.json({});
    },
    port: 0,
  });

  const previousEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  const previousHeaders = process.env['OTEL_EXPORTER_OTLP_METRICS_HEADERS'];

  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = `http://127.0.0.1:${server.port}`;

  process.env['OTEL_EXPORTER_OTLP_METRICS_HEADERS'] =
    'Authorization=Bearer test-token,X-Axiom-Metrics-Dataset=vers-metrics';

  onTestFinished(async () => {
    if (previousEndpoint === undefined) {
      delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    } else {
      process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = previousEndpoint;
    }

    if (previousHeaders === undefined) {
      delete process.env['OTEL_EXPORTER_OTLP_METRICS_HEADERS'];
    } else {
      process.env['OTEL_EXPORTER_OTLP_METRICS_HEADERS'] = previousHeaders;
    }

    metrics.disable();

    await server.stop();
  });

  const metricsExport = startMetricsExport({ serviceName: 'test-service' });
  const counter = metrics.getMeter('test-service').createCounter('test.shipped');

  counter.add(1);

  await metricsExport.stop();

  expect(received).toHaveLength(1);

  expect(received[0]).toMatchObject({
    auth: 'Bearer test-token',
    contentType: 'application/x-protobuf',
    dataset: 'vers-metrics',
    path: '/v1/metrics',
  });

  expect(received[0]?.bodyBytes).toBeGreaterThan(0);
});
