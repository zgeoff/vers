import { expect, onTestFinished, test } from 'bun:test';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { findTraceContext } from '@vers/service-utils';
import { withRequestTrace } from './with-request-trace';

function setupSpanCapture() {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  return { exporter };
}

test('it continues the trace named by a valid inbound traceparent', async () => {
  const request = new Request('https://example.test/nexus', {
    headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  });

  const response = await withRequestTrace(request, () => Promise.resolve(new Response('ok')));

  expect(response.headers.get('x-trace-id')).toBe('0af7651916cd43dd8448eb211c80319c');
});

test('it starts a fresh trace when no traceparent came in', async () => {
  const response = await withRequestTrace(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/u);
});

test('it starts a fresh trace when the inbound traceparent is malformed', async () => {
  const request = new Request('https://example.test/nexus', {
    headers: { traceparent: '00-not-a-real-header' },
  });

  const response = await withRequestTrace(request, () => Promise.resolve(new Response('ok')));

  expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/u);
});

test('it exposes the trace scope to work running inside the request', async () => {
  const request = new Request('https://example.test/nexus', {
    headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  });

  let observed = findTraceContext();

  await withRequestTrace(request, () => {
    observed = findTraceContext();

    return Promise.resolve(new Response('ok'));
  });

  expect(observed?.traceID).toBe('0af7651916cd43dd8448eb211c80319c');
  expect(findTraceContext()).toBeUndefined();
});

test('it relays a redirect response even when its headers refuse the stamp', async () => {
  // Node marks redirect headers immutable while Bun leaves them writable; a set-refusing Headers
  // stand-in pins the immutable behaviour so the test exercises the same path in both runtimes
  class SealedHeaders extends Headers {
    override set(): never {
      throw new TypeError('immutable');
    }
  }

  const redirect = Response.redirect('https://example.test/nexus', 301);

  Object.defineProperty(redirect, 'headers', {
    value: new SealedHeaders(redirect.headers),
  });

  const response = await withRequestTrace(new Request('https://example.test/nexus/'), () =>
    Promise.resolve(redirect),
  );

  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://example.test/nexus');
  expect(response).toBe(redirect);
  expect(response.headers.get('x-trace-id')).toBeNull();
});

test('it opens a SERVER span for a request once a tracer provider is registered, reporting x-trace-id as the span trace id', async () => {
  const ctx = setupSpanCapture();

  const request = new Request('https://example.test/nexus', {
    headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  });

  const response = await withRequestTrace(request, () => Promise.resolve(new Response('ok')));

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.name).toBe('GET /nexus');
  expect(span?.spanContext().traceId).toBe('0af7651916cd43dd8448eb211c80319c');
  expect(response.headers.get('x-trace-id')).toBe('0af7651916cd43dd8448eb211c80319c');
});

test('it marks the span failed for a 5xx response', async () => {
  const ctx = setupSpanCapture();

  await withRequestTrace(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('boom', { status: 500 })),
  );

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});

test('it marks the span failed and rethrows when the handler throws', async () => {
  const ctx = setupSpanCapture();

  const pending = withRequestTrace(new Request('https://example.test/nexus'), () => {
    throw new Error('handler exploded');
  });

  expect(pending).rejects.toThrowWithMessage(Error, 'handler exploded');

  await expect(pending).toReject();

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});

test('it skips opening a span for a served static asset', async () => {
  const ctx = setupSpanCapture();

  await withRequestTrace(new Request('https://example.test/app.js'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(ctx.exporter.getFinishedSpans()).toHaveLength(0);
});

test('it skips opening a span for the /health probe', async () => {
  const ctx = setupSpanCapture();

  await withRequestTrace(new Request('https://example.test/health'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(ctx.exporter.getFinishedSpans()).toHaveLength(0);
});
