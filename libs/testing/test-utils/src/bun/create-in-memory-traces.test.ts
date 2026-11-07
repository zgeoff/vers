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

  const observed = await trace
    .getTracer('test-memory')
    .startActiveSpan('queue.drain', async (span) => {
      await Promise.resolve();

      const active = trace.getActiveSpan();

      span.end();

      return { active, span };
    });

  expect(observed.active).toBe(observed.span);
});

test('it injects a traceparent and the baggage for the active context', () => {
  createInMemoryTraces();

  const carrier: Record<string, string> = {};

  const spanContext = trace.getTracer('test-memory').startActiveSpan('outbound.call', (span) => {
    const withBaggage = propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ region: { value: 'east-dock' } }),
    );

    propagation.inject(withBaggage, carrier);
    span.end();

    return span.spanContext();
  });

  expect(carrier).toStrictEqual({
    baggage: 'region=east-dock',
    traceparent: `00-${spanContext.traceId}-${spanContext.spanId}-01`,
  });
});
