import { expect, onTestFinished, test } from 'bun:test';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { findTraceContext } from './find-trace-context';
import { withRootSpan } from './with-root-span';

function setupTest() {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  return { exporter };
}

test('it exposes a trace context derived from the opened span inside the scope', async () => {
  const ctx = setupTest();
  let observed: string | undefined;

  await withRootSpan('test.root', () => {
    observed = findTraceContext()?.traceID;

    return Promise.resolve();
  });

  const [span] = ctx.exporter.getFinishedSpans();

  expect(observed).toBe(span?.spanContext().traceId);
});

test('it ends the span and marks it failed when the scope throws', async () => {
  const ctx = setupTest();

  const pending = withRootSpan('test.root', () => {
    throw new Error('scope failed');
  });

  expect(pending).rejects.toThrowWithMessage(Error, 'scope failed');

  await expect(pending).toReject();

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});

test('it stays inert without a registered tracer provider', async () => {
  let observed: string | undefined;

  await withRootSpan('test.root', () => {
    observed = findTraceContext()?.traceID;

    return Promise.resolve();
  });

  expect(observed).toMatch(/^[0-9a-f]{32}$/u);
});
