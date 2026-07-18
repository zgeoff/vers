import { expect, onTestFinished, test } from 'bun:test';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import type { StandardLinkClientInterceptorOptions } from '@orpc/client/standard';
import type { StandardLazyResponse } from '@orpc/standard-server';
import { withTraceContext } from '../trace/with-trace-context';
import { buildTracingInterceptor } from './build-tracing-interceptor';

function buildOptions(
  next: () => Promise<StandardLazyResponse>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a hand-built stub shaped like oRPC's interceptor options; the framework type has no readonly form
): StandardLinkClientInterceptorOptions<Record<never, never>> & { next: typeof next } {
  return {
    context: {},
    input: undefined,
    next,
    path: ['session', 'refreshTokens'],
    request: {
      body: undefined,
      headers: {},
      method: 'POST',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  };
}

function buildResponse(status: number): StandardLazyResponse {
  return { body: () => Promise.resolve(undefined), headers: {}, status };
}

test('it injects a traceparent built from the ambient trace context', async () => {
  const interceptor = buildTracingInterceptor();
  const options = buildOptions(() => Promise.resolve(buildResponse(200)));

  await withTraceContext(
    { spanID: '00f067aa0ba902b7', traceID: '4bf92f3577b34da6a3ce929d0e0e4736' },
    () => interceptor(options),
  );

  expect(options.request.headers['traceparent']).toBe(
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  );
});

test('it injects a traceparent built from a fresh trace when no ambient scope exists', async () => {
  const interceptor = buildTracingInterceptor();
  const options = buildOptions(() => Promise.resolve(buildResponse(200)));

  await interceptor(options);

  expect(options.request.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});

test('it names the client span by the procedure path and marks it failed on a 5xx response', async () => {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  const interceptor = buildTracingInterceptor();
  const options = buildOptions(() => Promise.resolve(buildResponse(500)));

  await interceptor(options);

  const [span] = exporter.getFinishedSpans();

  expect(span?.name).toBe('session.refreshTokens');
  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});

test('it marks the span failed and rethrows when the transport call throws', async () => {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  const interceptor = buildTracingInterceptor();
  const options = buildOptions(() => Promise.reject(new Error('transport down')));
  const pending = interceptor(options);

  expect(pending).rejects.toThrowWithMessage(Error, 'transport down');

  await expect(pending).toReject();

  const [span] = exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});
