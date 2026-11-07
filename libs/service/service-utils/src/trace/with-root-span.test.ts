import { expect, test } from 'bun:test';
import { SpanStatusCode } from '@opentelemetry/api';
import { createInMemoryTraces } from '@vers/test-utils/bun';
import { findTraceContext } from './find-trace-context';
import { withRootSpan } from './with-root-span';

function setupTest() {
  return createInMemoryTraces();
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
