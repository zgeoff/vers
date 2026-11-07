import { expect, test } from 'bun:test';
import { SpanStatusCode } from '@opentelemetry/api';
import type { StandardLinkClientInterceptorOptions } from '@orpc/client/standard';
import type { StandardLazyResponse } from '@orpc/standard-server';
import { createInMemoryTraces } from '@vers/test-utils/bun';
import { withTraceContext } from '../trace/with-trace-context';
import { makeTracingInterceptor } from './make-tracing-interceptor';

function setupTest() {
  return createInMemoryTraces();
}

// this test and the next run with no tracer provider: a registered one opens a client span, whose
// own IDs then replace the ambient ones in the header
test('it injects a traceparent built from the ambient trace context', async () => {
  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<string, never>> & {
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

  const options: StandardLinkClientInterceptorOptions<Record<string, never>> & {
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
  const ctx = setupTest();
  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<string, never>> & {
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

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.name).toBe('session.refreshTokens');
  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});

test('it marks the span failed and rethrows when the transport call throws', async () => {
  const ctx = setupTest();
  const interceptor = makeTracingInterceptor();

  const options: StandardLinkClientInterceptorOptions<Record<string, never>> & {
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

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});
