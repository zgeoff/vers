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
import { makeTracingInterceptor } from './make-tracing-interceptor';

test('it injects a traceparent built from the ambient trace context', async () => {
  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<never, never>> & {
    next: () => Promise<StandardLazyResponse>;
  } = {
    context: {},
    input: undefined,
    next: () =>
      Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 200 }),
    path: ['session', 'refreshTokens'],
    request: {
      body: undefined,
      headers: {},
      method: 'POST',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  };

  await withTraceContext(
    { spanID: '00f067aa0ba902b7', traceID: '4bf92f3577b34da6a3ce929d0e0e4736' },
    () => interceptor(options),
  );

  expect(options.request.headers['traceparent']).toBe(
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  );
});

test('it injects a traceparent built from a fresh trace when no ambient scope exists', async () => {
  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<never, never>> & {
    next: () => Promise<StandardLazyResponse>;
  } = {
    context: {},
    input: undefined,
    next: () =>
      Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 200 }),
    path: ['session', 'refreshTokens'],
    request: {
      body: undefined,
      headers: {},
      method: 'POST',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  };

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

  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<never, never>> & {
    next: () => Promise<StandardLazyResponse>;
  } = {
    context: {},
    input: undefined,
    next: () =>
      Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 500 }),
    path: ['session', 'refreshTokens'],
    request: {
      body: undefined,
      headers: {},
      method: 'POST',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  };

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

  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<never, never>> & {
    next: () => Promise<StandardLazyResponse>;
  } = {
    context: {},
    input: undefined,
    next: () => Promise.reject(new Error('transport down')),
    path: ['session', 'refreshTokens'],
    request: {
      body: undefined,
      headers: {},
      method: 'POST',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  };

  const pending = interceptor(options);

  expect(pending).rejects.toThrowWithMessage(Error, 'transport down');

  await expect(pending).toReject();

  const [span] = exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});
