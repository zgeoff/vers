import { expect, test } from 'bun:test';
import { context, propagation, trace } from '@opentelemetry/api';
import { createInMemoryTraces } from './create-in-memory-traces';

test('it records each ended span by name', () => {
  const traces = createInMemoryTraces();

  trace.getTracer('test-memory').startSpan('cache.refresh').end();

  expect(traces.exporter.getFinishedSpans().map((span) => span.name)).toStrictEqual([
    'cache.refresh',
  ]);
});

test('it keeps a span active across an await', async () => {
  createInMemoryTraces();

  await trace.getTracer('test-memory').startActiveSpan('queue.drain', async (span) => {
    await Promise.resolve();

    expect(trace.getActiveSpan()).toBe(span);

    span.end();
  });
});

test('it injects a traceparent header for the active span', () => {
  createInMemoryTraces();

  const carrier: Record<string, string> = {};

  trace.getTracer('test-memory').startActiveSpan('outbound.call', (span) => {
    propagation.inject(context.active(), carrier);
    span.end();
  });

  expect(carrier['traceparent']).toMatch(/^00-[\da-f]{32}-[\da-f]{16}-01$/u);
});
