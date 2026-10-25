import { expect, onTestFinished, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { configureLogging } from './configure-logging';
import { createOTLPLogSink } from './create-otlp-log-sink';

interface ReceivedExport {
  readonly auth: string | null;
  readonly body: string;
  readonly contentType: string | null;
  readonly dataset: string | null;
  readonly path: string;
}

test('it ships a log entry to the OTLP logs endpoint with its level, category and fields', async () => {
  const received: Array<ReceivedExport> = [];

  const handleRequest = async (request: Request): Promise<Response> => {
    const bytes = await request.arrayBuffer();

    received.push({
      auth: request.headers.get('authorization'),

      // protobuf writes each string field as its raw UTF-8 bytes, so a decoded body shows them
      body: new TextDecoder().decode(bytes),
      contentType: request.headers.get('content-type'),
      dataset: request.headers.get('x-axiom-dataset'),
      path: new URL(request.url).pathname,
    });

    return Response.json({});
  };

  const server = Bun.serve({
    fetch: handleRequest,
    port: 0,
  });

  onTestFinished(async () => {
    await server.stop();
  });

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', `http://127.0.0.1:${server.port}`);

  updateEnv(
    'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
    'Authorization=Bearer test-token,X-Axiom-Dataset=vers-logs',
  );

  const otlpLogSink = createOTLPLogSink({ serviceName: 'test-service' });

  const logger = configureLogging({
    category: 'test-billing',
    format: 'json',
    level: 'info',
    sinks: [otlpLogSink.sink],
  });

  logger.warn('quota exceeded', { tenantTier: 'gold-tier' });

  await otlpLogSink.flush();

  expect(received).toHaveLength(1);

  expect(received[0]).toMatchObject({
    auth: 'Bearer test-token',
    contentType: 'application/x-protobuf',
    dataset: 'vers-logs',
    path: '/v1/logs',
  });

  expect(received[0]?.body).toIncludeMultiple([
    'quota exceeded',
    'warning',
    'category',
    'test-billing',
    'tenantTier',
    'gold-tier',
  ]);
});
