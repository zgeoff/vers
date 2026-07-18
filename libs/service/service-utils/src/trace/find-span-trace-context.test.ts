import { expect, onTestFinished, test } from 'bun:test';
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { findSpanTraceContext } from './find-span-trace-context';

function setupTest() {
  const provider = new NodeTracerProvider();

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  return { tracer: provider.getTracer('test') };
}

test('it is undefined outside any active span', () => {
  expect(findSpanTraceContext()).toBeUndefined();
});

test('it derives the trace and span ids from the active span', () => {
  const ctx = setupTest();

  ctx.tracer.startActiveSpan('test-span', (span) => {
    const spanContext = span.spanContext();

    expect(findSpanTraceContext()).toStrictEqual({
      spanID: spanContext.spanId,
      traceID: spanContext.traceId,
    });

    span.end();
  });
});

test('it is undefined again once the span ends and the scope exits', () => {
  const ctx = setupTest();

  ctx.tracer.startActiveSpan('test-span', (span) => {
    span.end();
  });

  expect(findSpanTraceContext()).toBeUndefined();
});
