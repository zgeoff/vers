import { expect, test } from 'bun:test';
import { trace } from '@opentelemetry/api';
import { createInMemoryTraces } from '@vers/test-utils/bun';
import { findSpanTraceContext } from './find-span-trace-context';

function setupTest() {
  createInMemoryTraces();

  return { tracer: trace.getTracer('test') };
}

test('it is undefined outside any active span', () => {
  expect(findSpanTraceContext()).toBeUndefined();
});

test('it derives the trace and span ids from the active span', () => {
  const ctx = setupTest();

  const observed = ctx.tracer.startActiveSpan('test-span', (span) => {
    span.end();

    return { found: findSpanTraceContext(), spanContext: span.spanContext() };
  });

  expect(observed.found).toStrictEqual({
    spanID: observed.spanContext.spanId,
    traceID: observed.spanContext.traceId,
  });
});

test('it is undefined again once the span ends and the scope exits', () => {
  const ctx = setupTest();

  ctx.tracer.startActiveSpan('test-span', (span) => {
    span.end();
  });

  expect(findSpanTraceContext()).toBeUndefined();
});
