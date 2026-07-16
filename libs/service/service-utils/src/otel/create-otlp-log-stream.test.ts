import { expect, onTestFinished, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { createOTLPLogStream } from './create-otlp-log-stream';

interface ReceivedExport {
  readonly auth: string | null;
  readonly bodyBytes: number;
  readonly contentType: string | null;
  readonly dataset: string | null;
  readonly path: string;
}

test('it ships written lines to the OTLP logs endpoint with the env-configured headers', async () => {
  const received: Array<ReceivedExport> = [];

  const server = Bun.serve({
    fetch: async (request) => {
      const body = await request.arrayBuffer();

      received.push({
        auth: request.headers.get('authorization'),
        bodyBytes: body.byteLength,
        contentType: request.headers.get('content-type'),
        dataset: request.headers.get('x-axiom-dataset'),
        path: new URL(request.url).pathname,
      });

      return Response.json({});
    },
    port: 0,
  });

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', `http://127.0.0.1:${server.port}`);

  updateEnv(
    'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
    'Authorization=Bearer test-token,X-Axiom-Dataset=vers-logs',
  );

  onTestFinished(async () => {
    await server.stop();
  });

  const stream = createOTLPLogStream({ serviceName: 'test-service' });

  stream.write(
    `${JSON.stringify({ level: 30, msg: 'shipped line', name: 'test-service', time: Date.now() })}\n`,
  );

  await stream.flush();

  expect(received).toHaveLength(1);

  expect(received[0]).toMatchObject({
    auth: 'Bearer test-token',
    contentType: 'application/x-protobuf',
    dataset: 'vers-logs',
    path: '/v1/logs',
  });

  expect(received[0]?.bodyBytes).toBeGreaterThan(0);
});

test('it survives a line that is not JSON without throwing', () => {
  const stream = createOTLPLogStream({ serviceName: 'test-service' });

  expect(() => {
    stream.write('plain text, not a pino line\n');
  }).not.toThrow();
});
